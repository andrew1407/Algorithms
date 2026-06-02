# Algorithms

A collection of classic algorithms and data structures implemented from scratch as standalone lab scripts in Python, JavaScript, and Haskell. Each script is self-contained, uses hardcoded sample input, and prints its step-by-step results to the console.

## Overview

The scripts live under `scripts/`, numbered by lab. Each one implements a single algorithm or data structure with its own demo data, so it can be run directly with no arguments or setup.

| # | Topic | Language | File |
| --- | --- | --- | --- |
| 1 | Insertion sort (odd/even split) | Python | `scripts/1-lab.py` |
| 2 | Inversion counting via merge sort (movie-preference comparison) | Python | `scripts/2-lab.py` |
| 3 | Quick sort by middle, last, and first pivot (with swap counts) | Python | `scripts/3-lab.py` |
| 4 | Pyramid build and running medians | Python | `scripts/4-lab.py` |
| 5 | Hash tables for pair-sum search (matrix and bit-vector) | JavaScript | `scripts/5-lab.js` |
| 6 | Binary search tree with root-to-node path-sum search | JavaScript | `scripts/6-lab.js` |
| 7 | Greedy algorithm — traveling salesman shortest path | Python | `scripts/7-lab.py` |
| 8 | Knapsack problem (subset selection by weight and price) | Python | `scripts/8-lab.py` |
| 1 (Haskell) | Insertion sort (odd/even split) | Haskell | `scripts/haskell/1-lab.hs` |

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

Labs 2 and 7 read interactively from standard input (`2-lab.py` prompts for user/movie counts and a user to compare; the rest use built-in sample arrays).

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
└── .gitignore
```
