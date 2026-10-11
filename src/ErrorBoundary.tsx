import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

// A crash in any screen used to leave a plain black screen. This shows what went wrong and lets the user try again.
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.warn('Screen crashed:', err?.message); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#101828', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Something went wrong</Text>
        <ScrollView style={{ maxHeight: 160, marginBottom: 16 }}><Text selectable style={{ color: '#CBD5E1', lineHeight: 20 }}>{String(this.state.err.message || this.state.err)}</Text></ScrollView>
        <Pressable onPress={() => { this.setState({ err: null }); this.props.onReset?.(); }} style={{ backgroundColor: '#D4AF37', borderRadius: 8, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#1A1405', fontWeight: '800' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
