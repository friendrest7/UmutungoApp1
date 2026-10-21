import React, { Children, cloneElement, isValidElement } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
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
  return <NativeText {...props}>{translateChildren(children, t)}</NativeText>;
}
