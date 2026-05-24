import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
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
 * Code128-B inspired barcode generator using SVG.
 * Encodes the SKU string as a visual barcode.
 */
const BarcodeGenerator = forwardRef<View, BarcodeGeneratorProps>(
  (
    {
      value,
      width = 280,
      height = 80,
      showText = true,
      style,
      background = '#FFFFFF',
      color = '#000000',
    },
    ref
  ) => {
    const bars = generateCode128Bars(value);
    const totalModules = bars.reduce((sum, b) => sum + b, 0);
    const moduleWidth = width / totalModules;

    let xPos = 0;
    const barElements: React.ReactNode[] = [];

    bars.forEach((width_modules, i) => {
      const barWidth = width_modules * moduleWidth;
      const isBar = i % 2 === 0;
      if (isBar) {
        barElements.push(
          <Rect
            key={i}
            x={xPos}
            y={0}
            width={barWidth}
            height={height}
            fill={color}
          />
        );
      }
      xPos += barWidth;
    });

    return (
      <View ref={ref} style={[styles.container, { backgroundColor: background }, style]}>
        <Svg width={width} height={height}>
          <Rect width={width} height={height} fill={background} />
          <G>{barElements}</G>
        </Svg>
        {showText && (
          <Text style={[styles.text, { color }]}>{value}</Text>
        )}
      </View>
    );
  }
);

/**
 * Simple Code128-B bar pattern generator.
 * Returns array of module widths alternating bar/space.
 */
function generateCode128Bars(text: string): number[] {
  const START_B = [2, 1, 1, 4, 1, 2];
  const STOP = [2, 3, 3, 1, 1, 1, 2];

  const CODE128B: Record<number, number[]> = {};
  const patterns = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],
    [1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],
    [1,3,2,2,1,2],[2,2,1,2,1,3],[2,2,1,3,1,2],[2,3,1,2,1,2],
    [1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],
    [1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],
    [3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],
    [3,2,2,1,1,2],[3,2,2,2,1,1],[2,1,2,1,2,3],[2,1,2,3,2,1],
    [2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],
    [1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],
    [1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],
    [3,1,3,1,2,1],[2,1,1,3,3,1],[2,3,1,1,3,1],[2,1,3,1,1,3],
    [2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],
    [3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],
    [1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],
    [1,4,1,2,2,1],[1,1,2,2,1,4],[1,1,2,4,1,2],[1,2,2,1,1,4],
    [1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],
    [2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],
    [1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],
    [4,2,1,2,1,1],[2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],
    [1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],
    [1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],
    [2,1,1,2,1,4],[2,1,1,2,3,2],[2,1,1,1,2,1]
  ];
  patterns.forEach((p, i) => { CODE128B[i] = p; });

  const bars: number[] = [...START_B];
  let checksum = 104; // START B value

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    checksum += (i + 1) * code;
    const pattern = CODE128B[code] ?? CODE128B[0];
    bars.push(...pattern);
  }

  const checksumMod = checksum % 103;
  bars.push(...(CODE128B[checksumMod] ?? CODE128B[0]));
  bars.push(...STOP);

  return bars;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
  },
  text: {
    marginTop: 4,
    fontSize: Fonts.sizes.xs,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});

BarcodeGenerator.displayName = 'BarcodeGenerator';
export default BarcodeGenerator;
