---
name: TanStack Query select-as-setState anti-pattern
description: Calling setState inside a useQuery select callback causes "Too many re-renders" because select runs during React's render phase.
---

## Rule
Never call a React state setter inside a TanStack Query `select` callback.

**Why:** `select` is called synchronously by TanStack Query during React's render pass to transform query data. Calling `setState` there triggers a state update in the middle of rendering, which React catches and throws "Too many re-renders. React limits the number of renders to prevent an infinite loop."

**How to apply:** When you need to sync query data into local state, do it in a `useEffect` watching the query's `data` return value:

```ts
// ❌ WRONG — setState in select runs during render
useQuery({
  select: (d) => { setMyState(d.count); return d; },
});

// ✅ CORRECT — useEffect runs after render
const { data } = useQuery({ ... });
useEffect(() => {
  if (data?.count !== undefined) setMyState(data.count);
}, [data]);
```

This was the root cause of the "Too many re-renders" crash in the live stream page (viewer count polling query in `ChannelLivePage`).
