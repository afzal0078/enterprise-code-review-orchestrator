---
description: Heuristics for algorithmic efficiency, computational complexity, memory management, and asynchronous I/O optimization
---

# Performance Optimization Analysis

Guidelines and patterns for detecting performance bottlenecks, unnecessary computations, resource leaks, and suboptimal I/O patterns.

## Algorithmic & Computational Efficiency
- **Time Complexity**: Flag quadratic $O(n^2)$ or higher nested loops where linear $O(n)$ with HashMaps/Sets or binary search $O(\log n)$ is feasible.
  * *Pattern*: In `for` loops, checking `array.indexOf()` or `array.includes()` inside another loop leads to $O(n \times m)$ runtime. Pre-indexing into a `Set` brings lookups to $O(1)$.
- **Redundant Iterations**: Avoid multiple full-pass traversals of collections (`.filter().map().filter()`) when a single combined pass or generator can accomplish the result.
- **Regular Expression Catastrophic Backtracking**: Guard against polynomial or exponential backtrack regex patterns matching unbounded user inputs.

## Memory & Resource Management
- **Event Listener / Subscription Leaks**: Uncleaned event emitters, timers (`setInterval`), or websocket connections that keep objects referenced in memory.
- **Large Dataset Materialization**: Buffering entire database tables or large files in memory instead of streaming or cursor pagination.
- **Object Allocations in Hot Paths**: Frequent allocation of transient closures or objects within high-frequency tight loops.

## Asynchronous I/O Optimization
- **Parallel vs. Sequential Requests**: Using sequential `await` inside loops when operations are independent. Replace with `Promise.all` or bounded parallel workers.
- **Connection Reuse**: Re-creating database connections or HTTP client instances per-request rather than utilizing connection pools.
- **Debounce / Throttle**: Ensure user-driven event triggers (search typeahead, scroll, window resize) are debounced or throttled appropriately.

## Review Metrics
- **Performance Impact**: High (blocking main thread / memory leak), Medium (suboptimal iteration / missing caching), Low (micro-optimizations).
