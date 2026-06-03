import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Fonts } from '../constants/theme';

interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  style?: ViewStyle;
  background?: string;
  color?: string;
}

/**
 * QR Code Generator using react-native-qrcode-svg.
 * Fully drop-in compatible replacement for the old 1D Barcode Generator.
 */
const BarcodeGenerator = forwardRef<View, BarcodeGeneratorProps>(
  (
    {
      value,
      width = 200,
      height = 200,
      showText = true,
      style,
      background = '#FFFFFF',
      color = '#000000',
    },
    ref
  ) => {
    // QR Codes are square, so we use the minimum of width and height as the size
    const size = Math.min(width, height);

    return (
      <View ref={ref} style={[styles.container, { backgroundColor: background }, style]}>
        <QRCode
          value={value}
          size={size - 24} // Leave some padding for QR code border/quiet zone
          color={color}
          backgroundColor={background}
          enableLinearGradient={false}
        />
        {showText && (
          <Text style={[styles.text, { color }]}>{value}</Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  text: {
    marginTop: 8,
    fontSize: Fonts.sizes.xs,
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: '700',
  },
});

BarcodeGenerator.displayName = 'BarcodeGenerator';
export default BarcodeGenerator;
