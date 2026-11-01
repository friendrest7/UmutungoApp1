import React, { Children, cloneElement, isValidElement } from 'react';
import { Platform, StyleSheet, Text as NativeText, type TextProps } from 'react-native';
import { useI18n } from '@/i18n';

function translateChildren(children: React.ReactNode, translate: (value: string) => string): React.ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') return translate(child);
    if (!isValidElement(child)) return child;
    const nested = (child.props as { children?: React.ReactNode }).children;
    if (nested === undefined) return child;
    return cloneElement(child as React.ReactElement<{ children?: React.ReactNode }>, undefined, translateChildren(nested, translate));
  });
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { t } = useI18n();
  const sansSerif = Platform.select({ ios: 'Lexend', android: 'Lexend', default: 'Lexend' });
  const textStyle = StyleSheet.flatten(props.style);
  const requestedFamily = textStyle?.fontFamily;
  const requestedWeight = String(textStyle?.fontWeight ?? '400');
  const fontFamily = requestedFamily?.startsWith('Lexend') && requestedFamily !== 'Lexend'
    ? requestedFamily
    : requestedWeight === '700' || requestedWeight === '800' || requestedWeight === '900'
      ? requestedWeight === '900' ? 'LexendBlack' : requestedWeight === '800' ? 'LexendExtraBold' : 'LexendBold'
      : requestedWeight === '600'
        ? 'LexendSemiBold'
        : requestedWeight === '500'
          ? 'LexendMedium'
          : sansSerif;
  return <NativeText {...props} style={[props.style, { fontFamily }]}>{translateChildren(children, t)}</NativeText>;
}
