import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <section aria-labelledby="counter-title" className="max-w-xs space-y-4 rounded-lg border p-5">
      <h1 id="counter-title" className="font-semibold">计数器预览</h1>
      <p>计数 <output aria-live="polite">{count}</output></p>
      <button
        type="button"
        className="rounded-md bg-slate-900 px-4 py-2 text-white"
        onClick={() => setCount((value) => value + 1)}
      >
        增加
      </button>
    </section>
  );
}
