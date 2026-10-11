// Props the analysis screens accept when they are shown inside the Analysis tab (src/screens/Analysis.tsx).
// Standalone use (no props) still works exactly as before.
export type BodyProps = {
  embedded?: boolean;                 // render without the page header / scroll view
  on?: boolean;                       // is this method open right now (replaces the "tab === N" check)
  symId?: string; setSymId?: (id: string) => void; // the pair is chosen once by the Analysis tab
  method?: string;                    // ICT Lab only: all | ict | smc | vsa | candle | pat
  group?: string;                     // Scanner only: market to scan (crypto | forex | deriv | favs), chosen on the Analysis page
  cfg?: { auto: boolean; alarm: boolean; minProb: number }; // Scanner only: the Scanner Setup toggles from the Analysis page
  onOpen?: (id: string, tf: string) => void;       // Scanner only: open a pair in the full analysis
};
