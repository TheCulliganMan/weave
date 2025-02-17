import React, {forwardRef, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {MOON_300, MOON_600, hexToRGB} from '../common/css/globals.styles';
import {Tooltip} from './Tooltip';
import {Icon} from './Icon';

const DEFAULT_TITLE = 'Something went wrong.';
const DEFAULT_SUBTITLE = 'Please check the panel configuration for errors.';
const DEFAULT_SUBTITLE2 = 'Thank you for your patience while Weave is in beta.';

type ErrorPanelProps = {
  title?: string;
  subtitle?: string;
  subtitle2?: string;
};

export const Centered = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;
Centered.displayName = 'S.Centered';

export const Circle = styled.div<{$size: number; $hoverHighlight: boolean}>`
  border-radius: 50%;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background-color: ${hexToRGB(MOON_300, 0.48)};
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background-color: ${props =>
      props.$hoverHighlight ? hexToRGB(MOON_300, 0.64) : undefined};
  }
`;
Circle.displayName = 'Circle';

export const Large = styled.div`
  width: fit-content;
  text-align: center;
  margin: 0 auto;
`;
Large.displayName = 'Large';

export const Title = styled.div`
  color: ${MOON_600};
  font-size: 18px;
  font-weight: 600;
  line-height: 140%;
  margin: 16px 0 8px 0;
`;
Title.displayName = 'Title';

export const Subtitle = styled.div`
  color: ${MOON_600};
  font-size: 15px;
  line-height: 140%;
`;
Subtitle.displayName = 'Subtitle';

export const ErrorPanelSmall = ({
  title,
  subtitle,
  subtitle2,
}: ErrorPanelProps) => {
  const titleStr = title ?? DEFAULT_TITLE;
  const subtitleStr = subtitle ?? DEFAULT_SUBTITLE;
  const subtitle2Str = subtitle2 ?? DEFAULT_SUBTITLE2;
  return (
    <Tooltip
      position="top center"
      trigger={
        <Circle $size={22} $hoverHighlight={true}>
          <Icon name="warning" width={16} height={16} />
        </Circle>
      }>
      <b>{titleStr}</b> {subtitleStr} {subtitle2Str}
    </Tooltip>
  );
};

export const ErrorPanelLarge = forwardRef<HTMLDivElement, ErrorPanelProps>(
  ({title, subtitle, subtitle2}, ref) => {
    const titleStr = title ?? DEFAULT_TITLE;
    const subtitleStr = subtitle ?? DEFAULT_SUBTITLE;
    const subtitle2Str = subtitle2 ?? DEFAULT_SUBTITLE2;
    return (
      <Large ref={ref}>
        <Circle $size={40} $hoverHighlight={false}>
          <Icon name="warning" width={24} height={24} />
        </Circle>
        <Title>{titleStr}</Title>
        <Subtitle>{subtitleStr}</Subtitle>
        <Subtitle>{subtitle2Str}</Subtitle>
      </Large>
    );
  }
);

export const ErrorPanel = (props: ErrorPanelProps) => {
  const thisRef = useRef<HTMLDivElement | null>(null);
  const largeRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState('measure');

  useEffect(() => {
    const thisW = thisRef.current?.clientWidth ?? 0;
    const thisH = thisRef.current?.clientHeight ?? 0;
    const largeW = largeRef.current?.clientWidth ?? 0;
    const largeH = largeRef.current?.clientHeight ?? 0;
    const largeFits = thisW >= largeW && thisH >= largeH;
    setMode(largeFits ? 'large' : 'small');
  }, []);

  return (
    <div ref={thisRef} style={{height: '100%'}}>
      {mode === 'large' ? (
        <Centered>
          <ErrorPanelLarge {...props} ref={largeRef} />
        </Centered>
      ) : mode === 'small' ? (
        <Centered>
          <ErrorPanelSmall {...props} />
        </Centered>
      ) : (
        <div style={{visibility: 'hidden'}}>
          <ErrorPanelLarge {...props} ref={largeRef} />
        </div>
      )}
    </div>
  );
};
