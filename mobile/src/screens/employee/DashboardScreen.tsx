import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, Row } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { checkIn, checkOut } from '@/store/dataSlice';

// ─── helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nowHHMMSS = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function elapsedSince(timeHHMM: string): number {
  const [h, m] = timeHHMM.split(':').map(Number);
  const now = new Date();
  const refMs = new Date().setHours(h, m, 0, 0);
  return Math.max(0, now.getTime() - refMs);
}
function fmtElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// Mock GPS
const mockFetchLocation = (): Promise<{ lat: number; lng: number; address: string }> =>
  new Promise((resolve) =>
    setTimeout(() => resolve({
      lat: 28.5355 + (Math.random() - 0.5) * 0.02,
      lng: 77.391 + (Math.random() - 0.5) * 0.02,
      address: 'Sector 62, Noida, Uttar Pradesh, India',
    }), 600)
  );

// ─── Check-in/out widget ──────────────────────────────────────────────────────
interface WidgetProps {
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  onCheckIn: () => void;
  onCheckOut: () => void;
  loading: boolean;
}

const CheckWidget: React.FC<WidgetProps> = ({
  checkedIn, checkedOut, checkInTime, checkOutTime, onCheckIn, onCheckOut, loading,
}) => {
  const t = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const [clock, setClock] = useState(nowHHMMSS());
  const [confirmingOut, setConfirmingOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setClock(nowHHMMSS());
      if (checkedIn && !checkedOut && checkInTime) {
        setElapsed(elapsedSince(checkInTime));
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [checkedIn, checkedOut, checkInTime]);

  // Completed day
  if (checkedIn && checkedOut) {
    return (
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 20,
        padding: 18, alignItems: 'center', marginHorizontal: 0,
      }}>
        <Ionicons name="checkmark-circle" size={48} color="#4ADE80" />
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 8 }}>
          Work day complete ✓
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6 }}>
          {checkInTime} — {checkOutTime}
          {checkInTime && checkOutTime ? (() => {
            const [h1, m1] = checkInTime.split(':').map(Number);
            const [h2, m2] = checkOutTime.split(':').map(Number);
            const hrs = Math.max(0, h2 + m2 / 60 - (h1 + m1 / 60));
            return `  ·  ${hrs.toFixed(1)}h worked`;
          })() : ''}
        </Text>
      </View>
    );
  }

  // Currently checked in — show timer + check-out
  if (checkedIn && checkInTime) {
    return (
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 20,
        padding: 18, alignItems: 'center',
      }}>
        {/* Timer ring */}
        <View style={{
          width: 130, height: 130, borderRadius: 65,
          borderWidth: 4, borderColor: '#4ADE80',
          backgroundColor: 'rgba(74,222,128,0.12)',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>
          <Text style={{ color: '#4ADE80', fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>
            {fmtElapsed(elapsed)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
            elapsed
          </Text>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 }}>
          Checked in at <Text style={{ color: '#fff', fontWeight: '800' }}>{checkInTime}</Text>
        </Text>

        {/* Inline confirm or check-out button */}
        {confirmingOut ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ color: '#FDE68A', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
              Confirm check out?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setConfirmingOut(false)}
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { setConfirmingOut(false); onCheckOut(); }}
                style={{ backgroundColor: '#F87171', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Yes, Check Out</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirmingOut(true)}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor: loading ? 'rgba(248,113,113,0.4)' : '#F87171',
              borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              {loading ? 'Processing…' : 'Check Out'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Not yet checked in
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 20,
      padding: 18, alignItems: 'center',
    }}>
      {/* Live clock */}
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>Current time</Text>
      <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 2, marginBottom: 16 }}>
        {clock}
      </Text>

      {/* Check-in button */}
      <Pressable
        onPress={onCheckIn}
        disabled={loading}
        style={({ pressed }) => ({
          backgroundColor: loading ? 'rgba(74,222,128,0.4)' : '#16A34A',
          borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#16A34A', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
        })}
      >
        <Ionicons name="log-in-outline" size={22} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
          {loading ? 'Getting GPS…' : 'Check In Now'}
        </Text>
      </Pressable>

      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
        GPS location will be captured automatically
      </Text>
    </View>
  );
};

// ─── Quick Action Tile ────────────────────────────────────────────────────────
const ActionTile: React.FC<{
  icon: any; label: string; color: string; badge?: number; onPress: () => void;
}> = ({ icon, label, color, badge, onPress }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minWidth: '46%',
        backgroundColor: t.colors.surface, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: t.colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: t.mode === 'dark' ? 0.2 : 0.05, shadowRadius: 5,
        elevation: 2, opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 12, backgroundColor: color + '18',
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
      }}>
        <Ionicons name={icon} size={22} color={color} />
        {badge != null && badge > 0 && (
          <View style={{
            position: 'absolute', top: -4, right: -4, backgroundColor: palette.absent,
            borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center',
            justifyContent: 'center', paddingHorizontal: 3,
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
};

// ─── Main screen ─────────────────────────────────────────────────────────────
const DashboardScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const attendance = useAppSelector((s) => s.data.attendance);
  const notifications = useAppSelector((s) => s.data.notifications);
  const balances = useAppSelector((s) => s.data.leaveBalances);
  const wfhRequests = useAppSelector((s) => s.data.wfhRequests);
  const appCheckInEnabled = useAppSelector((s) => s.data.appCheckInEnabled);

  const [checkInLoading, setCheckInLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayRec = attendance.find((a) => a.userId === user.id && a.date === today);
  const unread = notifications.filter((n) => !n.read).length;
  const lateMarks = useMemo(
    () => attendance.filter((a) => a.userId === user.id && a.late).length,
    [attendance, user.id]
  );
  const leavesRemaining = balances.reduce((s, b) => s + b.available, 0);
  const recent = attendance.filter((a) => a.userId === user.id).slice(0, 4);

  // ── Work Mode Engine ────────────────────────────────────────────────────
  // WFO  → always use ESSL biometric device (app check-in never shown)
  // WFH  → show if HR has globally enabled app check-in
  // Hybrid → show only if appCheckInEnabled AND today has an approved WFH
  const canCheckInViaApp = useMemo(() => {
    if (!appCheckInEnabled) return false;
    if (user.workMode === 'WFO') return false;
    if (user.workMode === 'WFH') return true;
    // Hybrid: requires an approved WFH request that covers today
    return wfhRequests.some(
      (w) => w.userId === user.id && w.status === 'Approved' && w.dates.includes(today)
    );
  }, [appCheckInEnabled, user.workMode, user.id, wfhRequests, today]);

  // Reason text shown when check-in is blocked
  const checkInBlockedReason = useMemo(() => {
    if (user.workMode === 'WFO')
      return { title: 'Office attendance via biometric only', sub: 'Please use your ESSL device to mark attendance.' };
    if (!appCheckInEnabled)
      return { title: 'App check-in is currently disabled', sub: 'Please use your biometric device to mark attendance.' };
    // Hybrid without today's WFH approval
    return { title: 'No approved WFH for today', sub: 'Apply for WFH or use your ESSL biometric device.' };
  }, [user.workMode, appCheckInEnabled]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateFmt = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      const loc = await mockFetchLocation();
      dispatch(checkIn({ userId: user.id, time: nowHHMM(), source: 'App', location: loc }));
    } catch {
      Alert.alert('Error', 'Could not capture GPS. Please try again.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = () => {
    dispatch(checkOut({ userId: user.id, time: nowHHMM() }));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ══════════════════════ HERO / CHECK-IN AREA ═══════════════════════ */}
      <View style={{
        backgroundColor: palette.primary,
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        paddingHorizontal: 18,
        paddingBottom: 24,
      }}>
        {/* Top row */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{greet} 👋</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 26, marginTop: 2 }}>
              {user.name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 }}>{dateFmt}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Badge label={user.workMode} color={user.workMode === 'WFH' ? '#4ADE80' : user.workMode === 'WFO' ? '#60A5FA' : '#FBBF24'} />
            <Pressable onPress={() => navigation.navigate('Notifications')} style={{ padding: 4, position: 'relative' }}>
              <Ionicons name="notifications-outline" size={25} color="#fff" />
              {unread > 0 && (
                <View style={{
                  position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7,
                  backgroundColor: palette.absent, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>
                    {unread > 9 ? '9+' : unread}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </Row>

        {/* Check-in / Check-out widget — gated by HR toggle + work-mode engine */}
        {canCheckInViaApp ? (
          <CheckWidget
            checkedIn={!!todayRec?.checkIn}
            checkedOut={!!todayRec?.checkOut}
            checkInTime={todayRec?.checkIn}
            checkOutTime={todayRec?.checkOut}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            loading={checkInLoading}
          />
        ) : (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 20,
            padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <Ionicons
              name={user.workMode === 'WFO' ? 'finger-print-outline' : user.workMode === 'Hybrid' && appCheckInEnabled ? 'home-outline' : 'finger-print-outline'}
              size={32}
              color="rgba(255,255,255,0.6)"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {checkInBlockedReason.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
                {checkInBlockedReason.sub}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ══════════════════════ CONTENT ════════════════════════════════════ */}
      <View style={{ padding: 16 }}>

        {/* Month summary */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
            This Month
          </Text>
          <Row style={{ gap: 8 }}>
            {[
              { label: 'Leave Left', value: String(leavesRemaining), color: palette.leave },
              { label: 'Late', value: String(lateMarks), color: palette.absent },
              { label: 'Mode', value: user.workMode, color: palette.wfh },
            ].map((s) => (
              <View key={s.label} style={{
                flex: 1, alignItems: 'center', backgroundColor: s.color + '12',
                borderRadius: 10, paddingVertical: 10,
                borderWidth: 1, borderColor: s.color + '25',
              }}>
                <Text style={{ color: s.color, fontSize: 18, fontWeight: '900' }}>{s.value}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 10, marginTop: 3, textAlign: 'center' }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </Row>
        </Card>

        {/* Quick actions */}
        <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12 }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <ActionTile icon="time-outline" label="Attendance Log" color={palette.wfh}
            onPress={() => navigation.navigate('Attendance', { screen: 'AttendanceLog' })} />
          <ActionTile icon="airplane-outline" label="Apply Leave" color={palette.leave}
            onPress={() => navigation.navigate('Leaves', { screen: 'LeaveApply' })} />
          <ActionTile icon="home-outline" label="WFH Request" color={palette.primary}
            onPress={() => navigation.navigate('Leaves', { screen: 'WFHRequest' })} />
          <ActionTile icon="grid-outline" label="Leave Balance" color={palette.present}
            onPress={() => navigation.navigate('Leaves', { screen: 'LeaveBalance' })} />
          <ActionTile icon="create-outline" label="Correction" color={palette.accent}
            onPress={() => navigation.navigate('CorrectionRequest')} />
          <ActionTile icon="calendar-outline" label="Monthly View" color="#8B5CF6"
            onPress={() => navigation.navigate('Attendance', { screen: 'MonthlyCalendar' })} />
        </View>

        {/* Recent attendance */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '800' }}>Recent Attendance</Text>
          <Pressable onPress={() => navigation.navigate('Attendance', { screen: 'AttendanceLog' })}>
            <Text style={{ color: t.colors.primary, fontWeight: '600', fontSize: 13 }}>View all →</Text>
          </Pressable>
        </Row>
        <Card>
          {recent.length === 0 ? (
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', paddingVertical: 12 }}>
              No records yet
            </Text>
          ) : (
            recent.map((a, i) => (
              <View key={a.id}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
                  <View>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{a.date}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {a.checkIn || '--:--'} → {a.checkOut || '--:--'}
                      {a.workingHours ? `  ·  ${a.workingHours.toFixed(1)}h` : ''}
                    </Text>
                  </View>
                  <Badge label={a.status} color={statusColor(a.status, t)} />
                </Row>
                {i < recent.length - 1 && (
                  <View style={{ height: 1, backgroundColor: t.colors.border }} />
                )}
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
};

export default DashboardScreen;
