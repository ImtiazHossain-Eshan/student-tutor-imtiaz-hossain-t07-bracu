# Arrays (sample notes)

Original sample notes for demonstrating the agent; not official course material.

## Declaring and creating arrays

An array stores a fixed number of values of the same type. Its length is set when it is created and cannot change.

```java
int[] marks = new int[5];          // five ints, all 0
String[] names = {"Rafi", "Nabila"}; // length 2
```

Array indices start at 0, so the last valid index is `length - 1`. `marks.length` is a field, not a method: there are no parentheses.

## ArrayIndexOutOfBoundsException

Accessing `marks[5]` on an array of length 5 throws `ArrayIndexOutOfBoundsException` at runtime. The most common cause is a loop condition written as `i <= marks.length` instead of `i < marks.length`. Read the exception message: it tells you the bad index and the array length.

## Traversing an array

```java
int sum = 0;
for (int i = 0; i < marks.length; i++) {
    sum += marks[i];
}
double average = (double) sum / marks.length;
```

Cast to `double` before dividing; `sum / marks.length` with two ints performs integer division and drops the fraction.

## Finding the maximum

Start with the first element, not with 0, so that an array of negative numbers still works:

```java
int max = marks[0];
for (int i = 1; i < marks.length; i++) {
    if (marks[i] > max) max = marks[i];
}
```

## Arrays are reference types

Assigning one array variable to another copies the reference, not the elements. After `int[] b = a;`, changing `b[0]` also changes `a[0]`, because both names refer to the same array.
