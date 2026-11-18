"""Browser-side glue for the GitHub Pages showcase.

The lab scripts are written to run top to bottom: they compute and print, and
lab 2 reads its sizes from stdin. Two loaders run them here without changing
them:

* run_script() executes a whole script with `print` and `input` replaced in its
  namespace, so its own output is captured and lab 2's stdin is fed from the
  page's form. Sample data such as `A = [...]` can be swapped for the user's
  values by rewriting that one assignment in the parsed source.
* load_lab() keeps only a script's imports, lambdas and functions/classes, so
  the page can call them with its own data (labs 3 and 7).

Lab 3's sorts get a list that records each read and write, holding numbers
that count comparisons, so every step can be replayed as bars.
"""
import ast
import io
import random
import re
from itertools import permutations

FRAME_LIMIT = 6000  # replay frames kept per sort; the counters stay exact past it


def source(n):
  path = f'labs/{n}-lab.py'
  return path, open(path).read()


def literal(value):
  return ast.parse(repr(value), mode='eval').body


def run_script(n, overrides=None, inputs=(), seed=None, transform=None):
  """Run a lab script top to bottom; returns (namespace, printed text)."""
  path, src = source(n)
  tree = ast.parse(src, path)
  for node in tree.body:
    match node:
      case ast.Assign(targets=[ast.Name(id=name)]) if overrides and name in overrides:
        node.value = literal(overrides[name])
  if transform: transform(tree)
  ast.fix_missing_locations(tree)
  out = io.StringIO()
  feed = iter(str(v) for v in inputs)

  def lab_print(*args, sep=' ', end='\n', file=None, flush=False):
    out.write(sep.join(str(a) for a in args) + end)

  def lab_input(prompt=''):
    value = next(feed)
    out.write(f'{prompt}{value}\n')  # echo what a terminal would show
    return value

  if seed is not None: random.seed(seed)
  ns = dict(__name__='__main__', print=lab_print, input=lab_input)
  exec(compile(tree, path, 'exec'), ns)
  return ns, out.getvalue()


def load_lab(n, keep_names=()):
  """Keep a script's imports, lambdas, functions and classes; drop the rest."""
  path, src = source(n)
  keep = []
  for node in ast.parse(src, path).body:
    match node:
      case ast.Import() | ast.ImportFrom() | ast.FunctionDef() | ast.ClassDef():
        keep.append(node)
      case ast.Assign(targets=[ast.Name(id=name)], value=value) if isinstance(value, ast.Lambda) or name in keep_names:
        keep.append(node)
  out = io.StringIO()
  ns = dict(__name__=path, print=lambda *a, sep=' ', end='\n', **k: out.write(sep.join(map(str, a)) + end))
  exec(compile(ast.Module(keep, type_ignores=[]), path, 'exec'), ns)
  return ns, out


# ------------------------------------------------------------------ lab 1 --
STEP = re.compile(r'^(\[.*\]), iteration: (\d+); placed value: (-?\d+);$')


def lab1(array):
  ns, text = run_script(1, dict(A=array))
  steps = []
  for line in text.splitlines():
    m = STEP.match(line.strip())
    if m: steps.append(dict(array=ast.literal_eval(m[1]), iteration=int(m[2]), value=int(m[3])))
  return dict(output=text, steps=steps, result=ns['A'])


# ------------------------------------------------------------------ lab 2 --
def lab2(users, movies, user, seed):
  ns, text = run_script(2, inputs=[users, movies, user], seed=seed)
  D, x = ns['D'], user
  # the script's priority lists, rebuilt the same way: other user's rank of the movie x ranked i-th
  priorities = {}
  for u in D:
    if u == x: continue
    p = [None] * movies
    for i in range(movies): p[D[x][i] - 1] = D[u][i]
    priorities[u] = p
  ranking = [dict(user=int(m[1]), inversions=int(m[2])) for m in re.finditer(r'^User (\d+): (\d+) inversions$', text, re.M)]
  # the inverted pairs behind each count, for the pairs view
  pairs = {u: [[i, j] for i in range(movies) for j in range(i + 1, movies) if p[i] > p[j]] for u, p in priorities.items()}
  return dict(output=text, ratings={str(k): v for k, v in D.items()}, priorities={str(k): v for k, v in priorities.items()},
              ranking=ranking, pairs={str(k): v for k, v in pairs.items()})


# ------------------------------------------------------------------ lab 3 --
class Tracer:
  def __init__(self, ns):
    self.ns, self.frames, self.cmp, self.writes, self.arr = ns, [], 0, 0, None

  def frame(self, arr, kind, idx):
    if len(self.frames) < FRAME_LIMIT:
      self.frames.append(dict(a=[int(v) for v in list.__iter__(arr)], k=kind, i=idx, s=self.ns['swap_counter'], c=self.cmp))


class Num:
  """An int that reports each comparison to the tracer."""
  __slots__ = ('v', 't')

  def __init__(self, v, t): self.v, self.t = v, t
  def __int__(self): return self.v
  def __repr__(self): return repr(self.v)

  def _cmp(self, other, op):
    t = self.t
    t.cmp += 1
    if t.arr is not None:  # where the two compared elements sit now (the pivot may be held in a variable)
      t.frame(t.arr, 'c', [i for x in (self, other) for i, y in enumerate(list.__iter__(t.arr)) if y is x])
    return op(self.v, other.v if isinstance(other, Num) else other)

  def __lt__(self, o): return self._cmp(o, lambda a, b: a < b)
  def __le__(self, o): return self._cmp(o, lambda a, b: a <= b)
  def __gt__(self, o): return self._cmp(o, lambda a, b: a > b)
  def __ge__(self, o): return self._cmp(o, lambda a, b: a >= b)


class Traced(list):
  def __init__(self, values, t):
    super().__init__(Num(v, t) for v in values)
    self.t = t

  def __setitem__(self, i, v):
    list.__setitem__(self, i, v)
    self.t.writes += 1
    self.t.frame(self, 'w', [i])


STRATEGIES = [('sort_middle', 'middle'), ('sort_last', 'last'), ('sort_first', 'first')]


def run_sorts(L, array, trace=True):
  left, right = 0, len(array) - 1
  L.update(A=list(array), left=left, right=right)  # the globals the sorts read
  pivots = dict(sort_middle=L['mid'](left, right), sort_last=right, sort_first=left)
  res = {}
  for fn, key in STRATEGIES:
    L['swap_counter'] = 0
    t = Tracer(L)
    arr = Traced(array, t)
    t.arr = arr if trace else None
    if not trace: t.frame = lambda *a: None
    t.frame(arr, 'start', [])
    L[fn](arr, pivots[fn], left, right)
    t.frame(arr, 'end', [])
    res[key] = dict(swaps=L[fn].counter, comparisons=t.cmp, writes=t.writes, result=[int(v) for v in list.__iter__(arr)],
                    pivot=pivots[fn], frames=t.frames, truncated=len(t.frames) >= FRAME_LIMIT)
  return res


def lab3(array, sweep_max, seed):
  L, _ = load_lab(3)
  runs = run_sorts(L, array)
  out = [f'Input array: {array}\n']
  for _, key in STRATEGIES:
    r = runs[key]
    out.append(f'Sorting by the {key} element - {r["swaps"]} comparisons:')  # the lab's own wording
    out.append(f'{r["result"]} \n')
  rng = random.Random(seed)
  sizes = list(range(5, sweep_max + 1, 5))
  sweep = {key: dict(swaps=[], comparisons=[]) for _, key in STRATEGIES}
  for n in sizes:
    arr = rng.sample(range(1, 1000), n)
    for key, r in run_sorts(L, arr, trace=False).items():
      sweep[key]['swaps'].append(r['swaps'])
      sweep[key]['comparisons'].append(r['comparisons'])
  return dict(output='\n'.join(out), runs=runs, sizes=sizes, sweep=sweep)


# ------------------------------------------------------------------ lab 4 --
def lab4(array):
  ns, text = run_script(4, dict(A=array))
  med = ns['medians']
  return dict(output=text, arrays=ns['arrays'],
              medians=[list(med[i + 1]) if isinstance(med[i + 1], tuple) else [med[i + 1]] for i in range(len(ns['arrays']))])


# ------------------------------------------------------------------ lab 7 --
def lab7(seed, n1, n2):
  L, out = load_lab(7)
  Graph = L['Graph']
  random.seed(seed)
  graphs = []
  # the script's usage block, with the vertex counts from the form
  for label, n in (('Graph_1', n1), ('Graph_2', n2)):
    g = Graph(n)
    out.write(('' if label == 'Graph_1' else '\n') + f'[{label}]:\n')
    out.write(f'vertices: {n}\nedges:\n{g.edges}\n')
    best = g.short_way()
    found = re.findall(r'through (\[.*?\])\.', out.getvalue())[-1]
    weight = lambda route: sum(g.edges[f'{min(a, b)} | {max(a, b)}'] for a, b in zip(route, route[1:]))
    seen, ways = set(), []
    for w in g.ways:
      if str(w) in seen: continue
      seen.add(str(w)); ways.append(dict(route=list(w), weight=weight(w)))
    optimum = None
    if n <= 8:
      o = min(permutations(range(1, n + 1)), key=weight)
      optimum = dict(route=list(o), weight=weight(o))
    graphs.append(dict(n=n, edges=g.edges, best=best, route=ast.literal_eval(found), ways=ways, optimum=optimum))
  return dict(output=out.getvalue(), graphs=graphs)


# ------------------------------------------------------------------ lab 8 --
def lab8(capacity, items):
  def use_items(tree):
    # swap the script's `a = obj('a', 4, 10)` lines for the page's items, in the same place
    body, at = [], None
    for node in tree.body:
      match node:
        case ast.Assign(value=ast.Call(func=ast.Name(id='obj'))):
          if at is None: at = len(body)
          continue
      body.append(node)
    calls = [ast.Expr(ast.Call(ast.Name('obj', ast.Load()), [literal(t), literal(w), literal(p)], [])) for t, w, p in items]
    tree.body = body[:at] + calls + body[at:]

  ns, text = run_script(8, dict(MAX_WEIGHT=capacity), transform=use_items)
  sets = []
  for titles, things in zip(ns['setTitles'], ns['sets']):
    sets.append(dict(titles=titles, weight=sum(p['weight'] for p in things), price=sum(p['price'] for p in things)))
  return dict(output=text, goods=ns['goods'], sets=sets, chosen=ns['things'], weight=ns['weight'], price=ns['price'])


RUNNERS = dict(lab1=lab1, lab2=lab2, lab3=lab3, lab4=lab4, lab7=lab7, lab8=lab8)
