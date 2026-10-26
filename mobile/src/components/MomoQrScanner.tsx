import { useEffect, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Modal, Pressable, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPhoneScanned: (phone: string) => void;
};

function phoneFromQr(data: string) {
  let candidate = data.trim();
  if (/^tel:/i.test(candidate)) candidate = candidate.slice(4).split(/[;,]/, 1)[0];
  else if (/^BEGIN:VCARD/i.test(candidate)) {
    const phoneLine = candidate.split(/\r?\n/).find((line) => /^TEL(?:;[^:]*)?:/i.test(line));
    if (!phoneLine) return null;
    candidate = phoneLine.slice(phoneLine.indexOf(':') + 1);
  } else {
    try {
      const url = new URL(candidate);
      const phoneParam = ['phone', 'msisdn', 'mobile', 'mobile_number', 'number']
        .map((key) => url.searchParams.get(key))
        .find(Boolean);
      if (phoneParam) candidate = phoneParam;
    } catch { /* A plain phone number can be encoded directly in the QR code. */ }
  }

  const compact = candidate.replace(/[\s().-]/g, '');
  if (!/^(?:\+?2507\d{8}|07\d{8})$/.test(compact)) return null;
  return compact.startsWith('07') ? `+250${compact.slice(1)}` : compact.startsWith('250') ? `+${compact}` : compact;
}

export default function MomoQrScanner({ visible, onClose, onPhoneScanned }: Props) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setScanned(false);
    setScanError('');
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [visible, permission, requestPermission]);

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    const phone = phoneFromQr(data);
    if (!phone) {
      setScanned(true);
      setScanError('This QR code does not contain a valid Rwanda MTN phone number. Try another code or enter the number manually.');
      return;
    }
    setScanned(true);
    onPhoneScanned(phone);
    onClose();
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#101714', paddingTop: 54, paddingHorizontal: 20, paddingBottom: 28, gap: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800' }}>Scan MoMo QR</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}><Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Close</Text></Pressable>
      </View>
      <Text style={{ color: '#d1d5db', lineHeight: 21 }}>Scan a QR code that contains a Rwanda MTN phone number. Check the number before requesting payment.</Text>
      {permission?.granted ? <View style={{ flex: 1, overflow: 'hidden', borderRadius: 20 }}>
        <CameraView style={{ flex: 1 }} active={visible} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : handleScan} />
        <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '30%', width: 240, height: 240, borderWidth: 3, borderColor: '#31d47a', borderRadius: 20 }} />
      </View> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', lineHeight: 22 }}>{permission?.granted === false && !permission.canAskAgain ? 'Camera permission is disabled. Enable camera access in your phone settings to scan a QR code.' : 'Allow camera access to scan a MoMo phone number QR code.'}</Text>
        {permission?.granted === false && permission.canAskAgain ? <Pressable style={{ backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }} onPress={() => void requestPermission()}><Text style={{ color: '#ffffff', fontWeight: '800' }}>Allow camera access</Text></Pressable> : null}
      </View>}
      {scanError ? <Text accessibilityRole="alert" style={{ color: '#ffb4ab', textAlign: 'center', lineHeight: 20 }}>{scanError}</Text> : null}
    </View>
  </Modal>;
}
