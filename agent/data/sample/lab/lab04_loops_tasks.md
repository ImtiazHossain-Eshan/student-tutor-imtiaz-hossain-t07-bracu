# Lab 4: Loops (sample lab sheet)

Original sample lab tasks for demonstrating the agent; not official course material.

## Task 1: Sum of digits

Read a positive integer `n` from the user and print the sum of its digits. Example: input 4821 prints 15.
Hint: `n % 10` gives the last digit and `n / 10` removes it. Repeat while `n > 0`.

## Task 2: Star pyramid

Read `h` and print a centred pyramid of height `h`. Row `r` (starting at 1) has `h - r` spaces followed by `2 * r - 1` stars.
Hint: use an outer loop for rows and two inner loops, one for spaces and one for stars.

## Task 3: Prime check

Read `n` and print whether it is prime. A prime has exactly two divisors, 1 and itself; 1 is not prime.
Hint: you only need to test divisors from 2 up to the square root of `n`; stop as soon as one divides `n`.

## Submission rules

Submit one `.java` file per task, named `Task1.java`, `Task2.java` and so on, before the end of the lab. Code that does not compile receives no marks for that task.
