import { Platform } from 'react-native';
import { getToken } from './api';

/**
 * Open/download a URL.
 * On web: fetches with the auth header and downloads the blob (protected endpoints
 * like PDFs can't be opened via window.open because the Bearer token can't be sent).
 * On native: downloads to cache, then opens the system share sheet.
 */
export async function openOrShare(url: string, filename: string): Promise<void> {
  try {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    if (Platform.OS === 'web') {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      return;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const dest = `${FileSystem.cacheDirectory || ''}${filename}`;
    const { uri } = await FileSystem.downloadAsync(url, dest, { headers });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    }
  } catch (e) {
    console.warn('Download failed', e);
  }
}