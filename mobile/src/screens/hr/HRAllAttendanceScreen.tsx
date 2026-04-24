import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { getLiveFeed, getMonthlyReport } from '@/services/api';

type RangeMode = 'Day' | 'Month';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface LiveEntry {
  id: string; empCode: string; name: string; department: string;
  punchIn: string | null; punchOut: string | null;
  workHours: number | null; status: string; source: string;
}

interface MonthlySummaryEntry {
  employeeId: string; name: string; department: string;
  present: number; late: number; absent: number; leave: number; totalWorkHours: string;
}

const HRAllAttendanceScreen: React.FC = () => {
  const t = useTheme();
  const nav = useNavigation<any>();
  const [mode, setMode] = useState<RangeMode>('Day');
  const [anchor, setAnchor] = useState(new Date());
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [filter, setFilter] = useState('All');

  // Day mode data
  const [feed, setFeed] = useState<LiveEntry[]>([]);
  const [feedDate, setFeedDate] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);

  // Month mode data
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryEntry[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchDayFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await getLiveFeed();
      setFeed(res.feed);
      setFeedDate(res.date);
    } catch { /* ignore */ } finally { setFeedLoading(false); }
  }, []);

  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await getMonthlyReport(
        anchor.getMonth() + 1,
        anchor.getFullYear(),
        dept !== 'All' ? dept : undefined,
      );
      setMonthlySummary(res.summary);
    } catch { /* ignore */ } finally { setMonthlyLoading(false); }
  }, [anchor, dept]);

  useEffect(() => {
    if (mode === 'Day') fetchDayFeed();
  }, [mode, fetchDayFeed]);

  useEffect(() => {
    if (mode === 'Month') fetchMonthly();
  }, [mode, fetchMonthly]);

  const departments = useMemo(() => {
    const all = mode === 'Day'
      ? feed.map((f) => f.department)
      : monthlySummary.map((s) => s.department);
    return ['All', ...Array.from(new Set(all)).filter(Boolean).sort()];
  }, [mode, feed, monthlySummary]);

  const statuses = ['All', 'Present', 'WFH', 'Leave', 'Absent'];

  // Day mode filtered rows
  const dayRows = useMemo(() => {
    let rows = feed;
    if (dept !== 'All') rows = rows.filter((r) => r.department === dept);
    if (filter !== 'All') rows = rows.filter((r) => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(q) || r.empCode.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [feed, dept, filter, search]);

  // Day totals
  const dayTotals = useMemo(() => {
    const c: Record<string, number> = { Present: 0, WFH: 0, Leave: 0, Absent: 0 };
    dayRows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [dayRows]);

  // Monthly filtered rows
  const monthRows = useMemo(() => {
    let rows = monthlySummary;
    if (dept !== 'All') rows = rows.filter((r) => r.department === dept);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [monthlySummary, dept, search]);

  const isLoading = mode === 'Day' ? feedLoading : monthlyLoading;

  const shiftAnchor = (delta: number) => {
    const d = new Date(anchor);
    if (mode === 'Day') d.setDate(d.getDate() + delta);
    else d.setMonth(d.getMonth() + delta);
    setAnchor(d);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      {/* Mode toggle */}
      <Row style={{ gap: 6, marginBottom: 12 }}>
        {(['Day', 'Month'] as const).map((m) => (
          <Pressable
            key={m} onPress={() => setMode(m)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10,
              backgroundColor: mode === m ? t.colors.primary : t.colors.surface,
              alignItems: 'center',
              borderWidth: 1, borderColor: mode === m ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : t.colors.text, fontWeight: '700' }}>{m}</Text>
          </Pressable>
        ))}
      </Row>

      {/* Date nav (Day mode shows today only — refresh; Month mode shows month) */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        {mode === 'Month' ? (
          <Pressable onPress={() => shiftAnchor(-1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        <Pressable onPress={mode === 'Day' ? fetchDayFeed : fetchMonthly} style={{ alignItems: 'center' }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>
            {mode === 'Day'
              ? (feedDate ? new Date(feedDate).toDateString() : new Date().toDateString())
              : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}
          </Text>
          <Text style={{ color: t.colors.primary, fontSize: 11 }}>tap to refresh</Text>
        </Pressable>
        {mode === 'Month' ? (
          <Pressable onPress={() => shiftAnchor(1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={t.colors.primary} />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
      </Row>

      {/* Search bar */}
      <View style={{
        backgroundColor: t.colors.surface, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: t.colors.border, marginBottom: 10,
      }}>
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search name or ID"
          placeholderTextColor={t.colors.textMuted}
          style={{ flex: 1, color: t.colors.text }}
        />
      </View>

      {/* Dept filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Row style={{ gap: 6, paddingRight: 8 }}>
          {departments.map((d) => (
            <Pressable
              key={d} onPress={() => setDept(d)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: dept === d ? t.colors.primary : t.colors.surface,
                borderWidth: 1, borderColor: dept === d ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: dept === d ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 12 }}>{d}</Text>
            </Pressable>
          ))}
        </Row>
      </ScrollView>

      {/* Status filter (Day only) */}
      {mode === 'Day' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <Row style={{ gap: 6, paddingRight: 8 }}>
            {statuses.map((s) => (
              <Pressable
                key={s} onPress={() => setFilter(s)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: filter === s ? t.colors.primary : t.colors.surface,
                  borderWidth: 1, borderColor: filter === s ? t.colors.primary : t.colors.border,
                }}
              >
                <Text style={{ color: filter === s ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 12 }}>{s}</Text>
              </Pressable>
            ))}
          </Row>
        </ScrollView>
      )}

      {isLoading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : mode === 'Day' ? (
        <>
          {/* Day totals bar */}
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: t.colors.text, fontWeight: '900', fontSize: 18 }}>{dayRows.length}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>Total</Text>
              </View>
              {['Present','WFH','Leave','Absent'].map((s) => (
                <View key={s} style={{ alignItems: 'center' }}>
                  <Text style={{ color: statusColor(s as any, t), fontWeight: '900', fontSize: 18 }}>
                    {dayTotals[s] ?? 0}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>{s}</Text>
                </View>
              ))}
            </Row>
          </Card>

          {dayRows.length === 0 ? (
            <Card><Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 16 }}>No records found</Text></Card>
          ) : (
            dayRows.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => nav.navigate('EmployeeAttendanceProfile', { empCode: item.empCode, name: item.name })}
                style={{ marginBottom: 10 }}
              >
                <Card>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <Avatar name={item.name} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {item.empCode} · {item.department}
                        </Text>
                        {(item.punchIn || item.punchOut) && (
                          <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            {item.punchIn
                              ? `In: ${new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Not in'}{' '}
                            {item.punchOut
                              ? `· Out: ${new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : ''}{' '}
                            {item.workHours ? `· ${item.workHours.toFixed(1)}h` : ''}
                          </Text>
                        )}
                      </View>
                    </Row>
                    <Badge label={item.status} color={statusColor(item.status as any, t)} />
                  </Row>
                </Card>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          {/* Monthly summary */}
          <SectionHeader title={`${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()} — ${monthRows.length} employees`} />
          {monthRows.length === 0 ? (
            <Card><Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 16 }}>No records found</Text></Card>
          ) : (
            monthRows.map((item) => (
              <Card key={item.employeeId} style={{ marginBottom: 10 }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.employeeId} · {item.department}
                    </Text>
                  </View>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{item.totalWorkHours}h</Text>
                </Row>
                <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={`Present: ${item.present}`} color={statusColor('Present', t)} />
                  <Badge label={`Late: ${item.late}`} color={statusColor('Absent', t)} />
                  <Badge label={`Absent: ${item.absent}`} color="#9CA3AF" />
                  {item.leave > 0 && <Badge label={`Leave: ${item.leave}`} color={statusColor('Leave', t)} />}
                </Row>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
};

export default HRAllAttendanceScreen;
