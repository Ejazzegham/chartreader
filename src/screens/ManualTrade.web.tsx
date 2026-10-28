import React from 'react';
import { useLayout } from '../win';
import ManualTradeMobile from './ManualTradeMobile';
import ManualTradeDesk from './ManualTradeDesk.web';

// Website on a wide screen: the Demo Trading dashboard. Narrow windows keep the phone terminal.
export default function ManualTrade() {
  return useLayout().mode === 'desktop' ? <ManualTradeDesk /> : <ManualTradeMobile />;
}
