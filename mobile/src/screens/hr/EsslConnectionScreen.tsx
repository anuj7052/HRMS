import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setConfig,
  setEnabled,
  setTesting,
  setError,
  ingestPunches,
} from '@/store/esslSlice';
import { bulkIngestPunches } from '@/store/dataSlice';
import { testConnection, fetchPunches } from '@/services/essl';
import { pushEsslPunches } from '@/services/api';

/** On Android emulator, 10.0.2.2 maps to the host machine's localhost. */
const LOCALHOST_HINT = Platform.select({
  ios: 'On a real iPhone, use your Mac\'s Wi-Fi IP (e.g. 192.168.x.x:4000) — "localhost" only works in the Simulator.',
  android: 'On a real Android device, use your PC\'s Wi-Fi IP (e.g. 192.168.x.x:4000). In the emulator use 10.0.2.2:4000.',
  default: 'Use the machine\'s local IP, not "localhost", when running on a physical device.',
});

const EsslConnectionScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const { config, enabled, connected, lastError, lastPolledAt, recent, totalToday, testing } =
    useAppSelector((s) => s.essl);
  const employees = useAppSelector((s) => s.data.employees);

  const [form, setForm] = useState(config);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState('2026-01-01');
  const [toDate, setToDate] = useState(todayStr);
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const update = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onTest = async () => {
    dispatch(setConfig(form));
    dispatch(setTesting(true));
    const r = await testConnection({ ...form, pollMs: form.pollMs });
    dispatch(setTesting(false));
    if (r.ok) {
      Alert.alert('Connected', r.message || 'Server responded successfully.');
      dispatch(setError(null));
    } else {
      Alert.alert('Connection failed', r.error || 'Unknown error');
      dispatch(setError(r.error || 'Failed'));
    }
  };

  const onToggle = (val: boolean) => {
    dispatch(setConfig(form));
    dispatch(setEnabled(val));
    if (!val) dispatch(setError(null));
  };

  const onFetchRange = async (overrideFrom?: string, overrideTo?: string) => {
    const effectiveFrom = (overrideFrom ?? fromDate).trim();
    const effectiveTo   = (overrideTo   ?? toDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      Alert.alert('Invalid From date', `"${effectiveFrom}" is not YYYY-MM-DD format.`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
      Alert.alert('Invalid To date', `"${effectiveTo}" is not YYYY-MM-DD format.`);
      return;
    }
    if (effectiveFrom > effectiveTo) {
      Alert.alert('Date error', 'From date must be before or equal to To date.');
      return;
    }
    dispatch(setConfig(form));
    setFetching(true);
    const r = await fetchPunches(form, {
      fromDate: `${effectiveFrom} 00:00:00`,
      toDate: `${effectiveTo} 23:59:59`,
    });
    setFetching(false);
    if (!r.ok) {
      Alert.alert('Fetch failed', r.error || 'Unknown error');
      dispatch(setError(r.error || 'Fetch failed'));
      return;
    }
    dispatch(ingestPunches(r.punches));
    dispatch(
      bulkIngestPunches(
        r.punches.map((p) => ({ empCode: p.empCode, timestamp: p.timestamp, direction: p.direction }))
      )
    );
    setLastFetch(new Date().toLocaleTimeString());
    // Count unique employee-days processed
    const days = new Set(r.punches.map((p) => p.empCode + '|' + p.timestamp.slice(0, 10))).size;

    // ── Also save to PostgreSQL via backend ──────────────────────────────
    let savedCount = 0;
    if (r.punches.length > 0) {
      try {
        const saveResult = await pushEsslPunches(
          r.punches.map((p) => ({ empCode: p.empCode, timestamp: p.timestamp, direction: p.direction }))
        );
        savedCount = saveResult.saved;
      } catch {
        // backend unreachable — data is still in Redux
      }
    }

    Alert.alert(
      'Attendance Updated ✓',
      `${r.punches.length} biometric punches merged.\n${days} employee-days updated.\n${savedCount > 0 ? `${savedCount} records saved to database.` : 'Could not save to database — check login.'}\n\nRange: ${effectiveFrom} → ${effectiveTo}`
    );
  };

  const onSeedDemo = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return;
    }
    const active = employees.filter((e) => e.active);
    if (active.length === 0) {
      Alert.alert('No employees', 'No active employees to seed.');
      return;
    }
    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    const punches: { empCode: string; timestamp: string; direction: 'in' | 'out' }[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      for (const emp of active) {
        // ~85% present per working day
        if (Math.random() > 0.85) continue;
        const inH = 9 + Math.floor(Math.random() * 2); // 9 or 10
        const inM = Math.floor(Math.random() * 60);
        const outH = 18 + Math.floor(Math.random() * 2); // 18 or 19
        const outM = Math.floor(Math.random() * 60);
        punches.push({
          empCode: emp.empCode,
          timestamp: `${dateStr} ${pad(inH)}:${pad(inM)}:00`,
          direction: 'in',
        });
        punches.push({
          empCode: emp.empCode,
          timestamp: `${dateStr} ${pad(outH)}:${pad(outM)}:00`,
          direction: 'out',
        });
      }
    }
    dispatch(bulkIngestPunches(punches));
    setLastFetch(new Date().toLocaleTimeString());
    Alert.alert(
      'Demo data generated',
      `Created ${punches.length} punches across ${active.length} employees from ${fromDate} to ${toDate} (weekdays only, ~85% attendance).`
    );
  };

  const statusLabel = !enabled
    ? 'OFF'
    : connected
    ? 'LIVE'
    : lastError
    ? 'ERROR'
    : 'CONNECTING';
  const statusColor = !enabled
    ? t.colors.textMuted
    : connected
    ? palette.present
    : lastError
    ? palette.absent
    : palette.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: statusColor + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="pulse" size={20} color={statusColor} />
            </View>
            <View>
              <Text style={{ color: t.colors.text, fontWeight: '700' }}>eTimeTrackLite</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                Polls every {Math.round(form.pollMs / 1000)}s
              </Text>
            </View>
          </Row>
          <Badge label={statusLabel} color={statusColor} />
        </Row>
        <View style={{ height: 12 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: t.colors.text, fontWeight: '600' }}>Auto-poll every 5s</Text>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ true: palette.primary, false: t.colors.border }}
          />
        </Row>
        {lastPolledAt && (
          <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 6 }}>
            Last poll: {new Date(lastPolledAt).toLocaleTimeString()} • {totalToday} punches today
          </Text>
        )}
        {lastError && (
          <Text style={{ color: t.colors.danger, fontSize: 12, marginTop: 6 }}>
            {lastError}
          </Text>
        )}
      </Card>

      <SectionHeader title="Connection" />
      <Card>
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginBottom: 6 }}>Source mode</Text>
        <Row style={{ gap: 6, marginBottom: 12 }}>
          {([
            { v: 'session', l: 'eTimeTrack' },
            { v: 'ebioserver', l: 'eBioServer' },
            { v: 'receiver', l: 'Receiver' },
            { v: 'adms', l: 'ADMS pull' },
            { v: 'soap', l: 'SOAP' },
          ] as const).map((opt) => (
            <Pressable
              key={opt.v}
              onPress={() => setForm((f) => ({ ...f, mode: opt.v }))}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: form.mode === opt.v ? t.colors.primary : t.colors.surfaceAlt,
              }}
            >
              <Text
                style={{
                  color: form.mode === opt.v ? '#fff' : t.colors.text,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {opt.l}
              </Text>
            </Pressable>
          ))}
        </Row>
        <Text style={{ color: t.colors.textMuted, fontSize: 11, marginBottom: 10 }}>
          {form.mode === 'session' &&
            'eTimeTrackLite Server (your http://98.70.41.54:85). Logs in with the web UI id/password and reads punches every 5 s.'}
          {form.mode === 'ebioserver' &&
            'eBioServerNew SOAP API (/Webservice.asmx). Per-day GetDeviceLogs + GetDeviceLogsByLogId for incremental polling. Use the same admin id/password.'}
          {form.mode === 'receiver' &&
            'Devices PUSH to this proxy. Set device "Cloud Server Address" = your Mac IP, port 4000. No credentials needed.'}
          {form.mode === 'adms' &&
            'Proxy will try common ADMS query paths on the server URL.'}
          {form.mode === 'soap' && 'For older eTimeTrackLite (port 8090, /iWsService.asmx, no login).'}
        </Text>
        <Input
          label="Proxy URL"
          value={form.proxyUrl}
          onChangeText={update('proxyUrl')}
          placeholder="http://192.168.1.10:4000"
          autoCapitalize="none"
        />
        <Text style={{ color: t.colors.warning, fontSize: 11, marginBottom: 10, lineHeight: 16 }}>
          ⚠ {LOCALHOST_HINT}
        </Text>
        {form.mode !== 'receiver' && (
          <>
            <Input
              label="eSSL Server URL"
              value={form.serverUrl}
              onChangeText={update('serverUrl')}
              placeholder="http://98.70.41.54:85"
              autoCapitalize="none"
            />
            <Input
              label="User ID"
              value={form.userName}
              onChangeText={update('userName')}
              placeholder="admin"
              autoCapitalize="none"
            />
            <Input
              label="Password"
              value={form.password}
              onChangeText={update('password')}
              placeholder="••••••••"
              secureTextEntry
            />
          </>
        )}
        <Input
          label="Poll interval (ms)"
          value={String(form.pollMs)}
          onChangeText={(v) => setForm((f) => ({ ...f, pollMs: Math.max(1000, Number(v) || 5000) }))}
          keyboardType="number-pad"
        />
        <Row style={{ gap: 10 }}>
          <Button
            title="Test connection"
            variant="secondary"
            onPress={onTest}
            loading={testing}
            style={{ flex: 1 }}
          />
          <Button
            title="Save"
            onPress={() => {
              dispatch(setConfig(form));
              Alert.alert('Saved', 'Configuration updated.');
            }}
            style={{ flex: 1 }}
          />
        </Row>
        {Platform.OS === 'web' && (
          <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 8 }}>
            Note: from a browser, "Proxy URL" must be reachable from this machine (e.g. http://localhost:4000).
          </Text>
        )}
      </Card>

      <SectionHeader title="Fetch attendance from eSSL" />
      <Card>
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginBottom: 8 }}>
          Set a date range, then tap Sync. First punch = Check-In, last punch = Check-Out.
        </Text>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="From (YYYY-MM-DD)" value={fromDate} onChangeText={setFromDate} placeholder="2026-03-01" autoCapitalize="none" keyboardType="default" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="To (YYYY-MM-DD)" value={toDate} onChangeText={setToDate} placeholder={todayStr} autoCapitalize="none" keyboardType="default" />
          </View>
        </Row>
        {/* Quick-pick chips — each just sets the date fields, then the single button fetches */}
        <Row style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([
            { l: 'Today',      f: todayStr,                                        t: todayStr },
            { l: 'Last 7',     f: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), t: todayStr },
            { l: 'This month', f: `${todayStr.slice(0, 7)}-01`,                    t: todayStr },
            { l: 'Apr 2026',   f: '2026-04-01',                                    t: todayStr },
            { l: 'Mar 2026',   f: '2026-03-01',                                    t: todayStr },
            { l: 'Mar → today',f: '2026-03-01',                                    t: todayStr },
          ] as const).map((p) => {
            const active = fromDate === p.f && toDate === p.t;
            return (
              <Pressable
                key={p.l}
                onPress={() => { setFromDate(p.f); setToDate(p.t); }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? t.colors.primary : t.colors.border,
                  backgroundColor: active ? t.colors.primary + '22' : t.colors.surfaceAlt,
                }}
              >
                <Text style={{ color: active ? t.colors.primary : t.colors.text, fontSize: 11, fontWeight: '700' }}>{p.l}</Text>
              </Pressable>
            );
          })}
        </Row>
        {/* Single fetch button — uses whatever is in the From/To fields */}
        <Button
          title={fetching ? 'Fetching…' : `📡 Sync  ${fromDate}  →  ${toDate}`}
          onPress={() => {
            // Always use the current state values — no hardcoding
            const liveToday = new Date().toISOString().slice(0, 10);
            const effectiveTo = toDate || liveToday;
            onFetchRange(fromDate, effectiveTo);
          }}
          loading={fetching}
        />
        <View style={{ height: 8 }} />
        <Button
          title="Generate demo data for this range"
          variant="secondary"
          onPress={onSeedDemo}
        />
        <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 6 }}>
          Use this if the eSSL server doesn't expose its API. Generates realistic check-in/out punches for every employee on weekdays in the selected range.
        </Text>
        {lastFetch && (
          <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 8 }}>Last fetch: {lastFetch}</Text>
        )}
      </Card>

      <SectionHeader title={`Recent punches (${recent.length})`} />
      {recent.length === 0 ? (
        <Card>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>
            No punches received yet. Enable auto-poll above.
          </Text>
        </Card>
      ) : (
        recent.slice(0, 25).map((p) => (
          <Card key={p.id} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>
                  {p.empName || p.empCode}
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                  {p.empCode} • {p.timestamp}
                </Text>
              </View>
              <Badge
                label={p.direction === 'in' ? 'IN' : 'OUT'}
                color={p.direction === 'in' ? palette.present : palette.primary}
              />
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default EsslConnectionScreen;
