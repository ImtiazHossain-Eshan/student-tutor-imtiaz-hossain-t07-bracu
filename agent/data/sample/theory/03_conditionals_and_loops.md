# Conditionals and Loops (sample notes)

These are original sample notes for demonstrating the agent. They are not official BRAC University material.

## if, else if, else

An `if` statement runs a block only when its condition is `true`. Conditions must be `boolean` expressions: `if (x = 5)` does not compile in Java, because `x = 5` is an assignment with type `int`. Use `==` to compare primitive values.

Order matters in an `else if` chain: Java checks the conditions top to bottom and runs only the first block whose condition is true. Put the most specific condition first.

## The for loop

A `for` loop has three parts: initialisation, condition and update.

```java
for (int i = 1; i <= 5; i++) {
    System.out.println(i);
}
```

The condition is checked before every iteration, including the first. The update runs after each iteration. The variable `i` only exists inside the loop.

## The while loop

Use `while` when you do not know in advance how many times to repeat. Make sure something inside the loop changes the condition, or the loop never ends (an infinite loop).

```java
int n = 1234, digits = 0;
while (n > 0) {
    n = n / 10;
    digits++;
}
```

## Off-by-one errors

An off-by-one error is a loop that runs one time too many or too few. Trace the first and last iteration by hand: which value does the variable have, and is the condition still true? `i < n` runs n times starting from 0; `i <= n` runs n + 1 times.

## Nested loops

A loop inside another loop. The inner loop completes all of its iterations for every single iteration of the outer loop, so two nested loops of n iterations each run the inner body n * n times. Nested loops are used to print patterns, for example a right triangle of stars:

```java
for (int row = 1; row <= 4; row++) {
    for (int col = 1; col <= row; col++) {
        System.out.print("*");
    }
    System.out.println();
}
```

## break and continue

`break` leaves the nearest enclosing loop immediately. `continue` skips the rest of the current iteration and moves on to the next one.
