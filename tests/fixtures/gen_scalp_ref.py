# Regenerates scalp_ref.json from the original script: python gen_scalp_ref.py /path/to/sd_doji_scalper.py
import sys, json, importlib.util, numpy as np, pandas as pd
spec = importlib.util.spec_from_file_location('S', sys.argv[1]); S = importlib.util.module_from_spec(spec); spec.loader.exec_module(S)
out = []
for seed, n in [(s, 600) for s in (4, 11, 37, 20, 19, 15, 8, 3)]:
    rng = np.random.default_rng(seed)
    ret = rng.normal(0, 0.0006, n) + 0.0008 * np.sin(np.arange(n) / (30 + seed * 7))
    close = 1.10 * np.exp(np.cumsum(ret)); open_ = np.r_[close[0], close[:-1]] * (1 + rng.normal(0, 0.00012, n))
    for i in rng.choice(n, n // 8, replace=False): close[i] = open_[i] * (1 + rng.normal(0, 0.00003))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.0004, n))); low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.0004, n)))
    df = pd.DataFrame(dict(time=pd.date_range('2024-01-01', periods=n, freq='5min'), open=open_, high=high, low=low, close=close))
    _, sigs, diag = S.run_engine(df, S.Params())
    out.append(dict(c=[[int(t.timestamp()), round(o, 8), round(h, 8), round(l, 8), round(c, 8)] for t, o, h, l, c in zip(df.time, df.open, df.high, df.low, df.close)],
        sigs=[[s['status'], s['side'], int(s['doji_idx']), -1 if s.get('confirm_idx') is None else int(s['confirm_idx']), s.get('entry'), s.get('stop')] for s in sigs]))
json.dump(out, open('scalp_ref.json', 'w'), separators=(',', ':'))
print([len(o['sigs']) for o in out])
