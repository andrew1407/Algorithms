#quick sort

from math import ceil

A = [30, 19, 9, 15, 55, 24, 3, 78, 46, 41]
print(f"Input array: {A}\n")
left = 0                                    #first el
right = len(A) - 1                          #last el
mid = lambda a, b: ceil((a + b) / 2)        #choosing middle index
pivot_mid = mid(left, right)                #middle pivot
pivot_last = right                          #last element
pivot_first = left                          #first element
swap_counter = 0                            #algorithm efficiency

#[FUNCTION 1] sorts by middle pivot:
def sort_middle(_arr, _pivot, _min, _max):
  global swap_counter
  #recursion exit
  if _min >= _max: return
  #sorting
  first = _min
  last = _max
  pivot_value = _arr[_pivot]      #the pivot moves while swapping, so keep its value
  while _min <= _max:
      while _arr[_min] < pivot_value:
          _min += 1
      while _arr[_max] > pivot_value:
          _max -= 1
      if _min > _max: break
      #elements swapping
      if _min < _max:
        val = _arr[_min]
        _arr[_min] = _arr[_max]
        _arr[_max] = val
        swap_counter += 1           #counter increasing
      _min += 1
      _max -= 1
  #recursions
  _pivot1 = mid(first, _max)
  _pivot2 = mid(_min, last)
  sort_middle(_arr, _pivot1, first, _max)
  sort_middle(_arr, _pivot2, _min, last)
  sort_middle.counter = swap_counter

#[FUNCTION 1] extra
sort_middle.out = lambda a: print(f"Sorting by the middle element - {a} comparisons:")
sort_middle.array = A.copy()
sort_middle.pivot = pivot_mid

#[FUNCTION 2] sorts by the last element:
def sort_last(arr, _pivot, _min = None, _max = None):
  global swap_counter
  if _pivot == left: return
  index = 0
  i = 0
  while i < _pivot:
    if arr[i] <= arr[_pivot]:
      val = arr[i]
      arr[i] = arr[index]
      arr[index] = val
      index += 1
      i += 1
      swap_counter += 1           #counter increasing
    else:
      val = arr[i]
      arr[i] = arr[_pivot]
      arr[_pivot] = val
      index = i
      swap_counter += 1           #counter increasing
  #pivot changing
  val = arr[index]
  arr[index] = arr[_pivot]
  arr[_pivot] = val
  swap_counter += 1                   #counter increasing
  #recursion
  sort_last(arr, _pivot - 1)
  sort_last.counter = swap_counter

#[FUNCTION 2] extra
sort_last.out = lambda a: print(f"Sorting by the last element - {a} comparisons:")
sort_last.array = A.copy()
sort_last.pivot = pivot_last

#[FUNCTION 3] sorts by the first element:
def sort_first(arr, _pivot, _min = None, _max = None):
  global swap_counter
  if _pivot == right: return
  index = right
  i = right
  while i > _pivot:
    if arr[i] >= arr[_pivot]:
      val = arr[i]
      arr[i] = arr[index]
      arr[index] = val
      index -= 1
      i -= 1
      swap_counter += 1           #counter increasing
    else:
      val = arr[i]
      arr[i] = arr[_pivot]
      arr[_pivot] = val
      index = i
      swap_counter += 1           #counter increasing
  #pivot changing
  val = arr[index]
  arr[index] = arr[_pivot]
  arr[_pivot] = val
  swap_counter += 1                   #counter increasing
  #recursion
  sort_first(arr, _pivot + 1)
  sort_first.counter = swap_counter
    
#[FUNCTION 3] extra
sort_first.out = lambda a: print(f"Sorting by the first element - {a} comparisons:")
sort_first.array = A.copy()
sort_first.pivot = pivot_first

#output
functions = [sort_middle, sort_last, sort_first]
for f in functions:
  f(f.array, f.pivot, left, right)
  f.out(f.counter)
  print(f.array, '\n')
  swap_counter = 0
