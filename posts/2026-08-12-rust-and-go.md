---
title: 'Rust & Go: A <fair> comparison?'
date: "2026-08-12"
tags: ["rust", "go", "languages"]
description: 'Comparing Rust & Go without declaring a "winner" — they solve different problems.'
---

Every few months someone asks which of the two they should learn, and the honest
answer is that the question is underspecified. They're both good. They're good at
different things.

## Where each one fits

Go optimizes for the time between "new engineer joins" and "new engineer ships
something." Rust optimizes for the time between "code compiles" and "code is
correct."

| Concern | Go | Rust |
| --- | --- | --- |
| Time to first ship | Fast | Slower |
| Runtime footprint | GC | No GC |
| Compile-time guarantees | Modest | Extensive |

## A small example

The same idea in both, roughly:

```go
func sum(xs []int) int {
    total := 0
    for _, x := range xs {
        total += x
    }
    return total
}
```

```rust
fn sum(xs: &[i32]) -> i32 {
    xs.iter().sum()
}
```

Neither is a revelation. That's sort of the point — for most day-to-day code the
languages are more similar than the arguments about them suggest.
