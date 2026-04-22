import '@expo/metro-runtime';
import 'react-native-gesture-handler';
import React from 'react';
import { Text, View, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useEsslPolling } from './src/hooks/useEsslPolling';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
          <Text style={{ color: '#c00', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            App crashed
          </Text>
          <Text selectable style={{ color: '#000', fontFamily: 'monospace', marginBottom: 8 }}>
            {String(this.state.error?.message ?? this.state.error)}
          </Text>
          <Text selectable style={{ color: '#444', fontFamily: 'monospace', fontSize: 12 }}>
            {String((this.state.error as any)?.stack ?? '')}
          </Text>
        </ScrollView>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <EsslPollingHost />
          <RootNavigator />
        </SafeAreaProvider>
      </Provider>
    </ErrorBoundary>
  );
}

function EsslPollingHost() {
  useEsslPolling();
  return null;
}
