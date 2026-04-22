import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { checkIn } from '@/store/dataSlice';

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Mock GPS — replaces expo-location for offline demo
const mockFetchLocation = (): Promise<{ lat: number; lng: number; address: string }> =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          lat: 28.5355 + (Math.random() - 0.5) * 0.02,
          lng: 77.391 + (Math.random() - 0.5) * 0.02,
          address: 'Sector 62, Noida, Uttar Pradesh, India',
        }),
      900
    )
  );

const CheckInScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;

  const [loc, setLoc] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mockFetchLocation()
      .then((l) => {
        setLoc(l);
        setLocLoading(false);
      })
      .catch(() => setLocLoading(false));
  }, []);

  const captureSelfie = () => {
    // Mock selfie capture — wire expo-camera in real build
    setSelfieTaken(true);
  };

  const submit = () => {
    if (!loc) return Alert.alert('Location required', 'GPS coordinates could not be captured.');
    setSubmitting(true);
    setTimeout(() => {
      dispatch(
        checkIn({
          userId: user.id,
          time: nowHHMM(),
          source: 'App',
          location: loc,
          selfieUri: selfieTaken ? 'mock://selfie.jpg' : undefined,
        })
      );
      setSubmitting(false);
      Alert.alert('Checked in', `Recorded at ${nowHHMM()}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }, 600);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row style={{ gap: 12 }}>
          <Avatar name={user.name} size={50} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>{user.name}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {user.empCode} · {user.workMode}
            </Text>
          </View>
          <Badge label={`Now · ${nowHHMM()}`} />
        </Row>
      </Card>

      <SectionHeader title="📍 GPS Location" />
      <Card>
        {locLoading ? (
          <Row style={{ gap: 10 }}>
            <ActivityIndicator color={t.colors.primary} />
            <Text style={{ color: t.colors.textMuted }}>Fetching coordinates…</Text>
          </Row>
        ) : loc ? (
          <>
            <View
              style={{
                height: 140,
                borderRadius: 10,
                backgroundColor: t.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <Ionicons name="map" size={40} color={t.colors.primary} />
              <Text style={{ color: t.colors.textMuted, marginTop: 8, fontSize: 12 }}>Map preview</Text>
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Latitude</Text>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{loc.lat.toFixed(5)}</Text>
              </View>
              <View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Longitude</Text>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{loc.lng.toFixed(5)}</Text>
              </View>
              <Badge label="GPS Locked" color={t.colors.success} />
            </Row>
            <Text style={{ color: t.colors.textMuted, marginTop: 10, fontSize: 13 }}>{loc.address}</Text>
          </>
        ) : (
          <Text style={{ color: t.colors.danger }}>Could not get location.</Text>
        )}
      </Card>

      <SectionHeader title="📸 Selfie verification (optional)" />
      <Card>
        <Pressable
          onPress={captureSelfie}
          style={{
            height: 200,
            borderRadius: 12,
            backgroundColor: selfieTaken ? t.colors.success + '22' : t.colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: selfieTaken ? t.colors.success : t.colors.border,
          }}
        >
          {selfieTaken ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color={t.colors.success} />
              <Text style={{ color: t.colors.success, fontWeight: '700', marginTop: 8 }}>Selfie captured</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>Face detection ✓</Text>
            </>
          ) : (
            <>
              <Ionicons name="camera-outline" size={42} color={t.colors.primary} />
              <Text style={{ color: t.colors.text, fontWeight: '700', marginTop: 8 }}>Tap to capture</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>Center your face in the frame</Text>
            </>
          )}
        </Pressable>
        {selfieTaken && (
          <Pressable onPress={() => setSelfieTaken(false)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
            <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Retake</Text>
          </Pressable>
        )}
      </Card>

      <View style={{ marginTop: 20 }}>
        <Button
          title={`Confirm Check-in @ ${nowHHMM()}`}
          onPress={submit}
          loading={submitting}
          disabled={!loc}
          icon={<Ionicons name="log-in-outline" size={18} color="#fff" />}
        />
        <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
      </View>
    </ScrollView>
  );
};

export default CheckInScreen;
