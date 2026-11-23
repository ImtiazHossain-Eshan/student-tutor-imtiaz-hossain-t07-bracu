# Methods (sample notes)

Original sample notes for demonstrating the agent; not official course material.

## Defining a method

A method groups statements under a name so they can be reused. Its header states the return type, the name and the parameters.

```java
public static int square(int x) {
    return x * x;
}
```

A `void` method returns nothing. A method with a non-void return type must return a value on every path, or the code does not compile ("missing return statement").

## Parameters are passed by value

Java copies the value of each argument into the parameter. Changing a primitive parameter inside the method does not change the caller's variable. For arrays and objects the copied value is a reference, so the method can change the elements of an array it receives, but it cannot make the caller's variable point to a different array.

## Overloading

Two methods may share a name if their parameter lists differ in number or types, for example `max(int, int)` and `max(double, double)`. A different return type alone is not enough.

## Scope

A variable declared inside a method (a local variable) exists only while that method runs. Variables declared in a block, such as a loop body, exist only inside that block.
