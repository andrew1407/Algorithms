# Algorithms

<p align="center">
  <a href="https://andrew1407.github.io/Algorithms/" title="Open the labs in the browser">
    <img src="web/icon.svg" alt="Algorithms Labs" width="96" height="96">
  </a>
</p>

[![pages deploy badge](https://github.com/andrew1407/Algorithms/actions/workflows/pages.yml/badge.svg)](https://andrew1407.github.io/Algorithms/)

A collection of classic algorithms and data structures implemented from scratch as standalone lab scripts in Python, JavaScript, and Haskell. Each script is self-contained, uses hardcoded sample input, and prints its step-by-step results to the console.

## Overview

The scripts live under [`scripts/`](scripts), numbered by lab. Each one implements a single algorithm or data structure with its own demo data, so it can be run directly with no arguments or setup.

| # | Topic | Language | File |
| --- | --- | --- | --- |
| 1 | Insertion sort (odd/even split) | Python | [`scripts/1-lab.py`](scripts/1-lab.py) |
| 2 | Inversion counting via merge sort (movie-preference comparison) | Python | [`scripts/2-lab.py`](scripts/2-lab.py) |
| 3 | Quick sort by middle, last, and first pivot (with swap counts) | Python | [`scripts/3-lab.py`](scripts/3-lab.py) |
| 4 | Pyramid build and running medians | Python | [`scripts/4-lab.py`](scripts/4-lab.py) |
| 5 | Hash tables for pair-sum search (matrix and bit-vector) | JavaScript | [`scripts/5-lab.js`](scripts/5-lab.js) |
| 6 | Binary search tree with root-to-node path-sum search | JavaScript | [`scripts/6-lab.js`](scripts/6-lab.js) |
| 7 | Greedy algorithm — traveling salesman shortest path | Python | [`scripts/7-lab.py`](scripts/7-lab.py) |
| 8 | Knapsack problem (subset selection by weight and price) | Python | [`scripts/8-lab.py`](scripts/8-lab.py) |
| 1 (Haskell) | Insertion sort (odd/even split) | Haskell | [`scripts/haskell/1-lab.hs`](scripts/haskell/1-lab.hs) |

## Showcase

**[Open the labs in the browser](https://andrew1407.github.io/Algorithms/)**. Every lab runs from its own source code, with editable sample data (or a random seed), step-by-step views of the algorithms, and buttons to copy each chart and drawing (PNG or CSV), table and set of results.

- **Python labs (1–4, 7, 8)** run in [PyScript](https://pyscript.net). [`web/showcase.py`](web/showcase.py) runs each script with its `print` and `input` captured, so lab 2's stdin is fed from the page, and its sample array swapped for the one in the form. Labs 3 and 7 have their functions and class called directly. Lab 3's sorts get a list that records each step, so they replay as bars.
- **JavaScript labs (5, 6)** are fetched and run as they are, with a captured `console`. Only their sample-data lines (`S`, `A`, the vertex list) are set from the form.
- **Haskell port of lab 1** is shown as source next to the Python lab. It isn't run, because there's no lightweight way to run GHC output in the browser.

Run it locally:

```sh
mkdir -p _site/web && cp web/*.html web/*.js web/*.py web/*.toml web/*.svg _site/web/ && cp -r scripts _site/
python -m http.server --directory _site      # then open http://localhost:8000/web/
```

The [pages workflow](.github/workflows/pages.yml) assembles and deploys it on every push to `main`.

## Tech stack

- **Python** — labs 1-4, 7, 8 (uses only the standard library: `random`, `math`).
- **JavaScript** — labs 5-6 (plain Node.js, no dependencies).
- **Haskell** — a Haskell port of the insertion-sort lab.

## Running

No build step or external dependencies are required.

Python:

```bash
python scripts/1-lab.py
```

Lab 2 reads interactively from standard input ([`2-lab.py`](scripts/2-lab.py) prompts for user/movie counts and a user to compare); lab 7 generates random graphs, and the rest use built-in sample data.

JavaScript (Node.js):

```bash
node scripts/5-lab.js
node scripts/6-lab.js
```

Haskell:

```bash
runghc scripts/haskell/1-lab.hs
# or compile:
ghc scripts/haskell/1-lab.hs -o 1-lab && ./1-lab
```

## Project structure

```
.
├── scripts/
│   ├── 1-lab.py        # insertion sort
│   ├── 2-lab.py        # inversion counting (merge sort)
│   ├── 3-lab.py        # quick sort (three pivots)
│   ├── 4-lab.py        # pyramid / medians
│   ├── 5-lab.js        # hash tables
│   ├── 6-lab.js        # binary tree
│   ├── 7-lab.py        # greedy TSP
│   ├── 8-lab.py        # knapsack
│   └── haskell/
│       └── 1-lab.hs    # insertion sort
├── web/                # GitHub Pages showcase
│   ├── index.html, app.js            # page, charts, step views, copy buttons
│   ├── bridge.py, showcase.py, pyscript.toml   # PyScript glue for the Python labs
│   └── icon.svg        # logo / favicon
└── .gitignore
```
