// Sample lab walkthrough: tracing the digit-sum loop step by step.
// Original sample code for demonstrating the agent; not official course material.
import java.util.Scanner;

public class DigitSumTrace {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int sum = 0;
        while (n > 0) {
            int digit = n % 10;   // last digit
            sum += digit;
            n = n / 10;           // drop the last digit
            System.out.println("digit=" + digit + " sum=" + sum + " n=" + n);
        }
        System.out.println("Sum of digits: " + sum);
    }
}
