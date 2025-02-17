import {
  GOLD_300,
  GOLD_600,
  GREEN_300,
  GREEN_600,
  hexToRGB,
  MOON_800,
  MOON_950,
  RED_300,
  RED_500,
  TEAL_300,
  TEAL_600,
} from '../common/css/globals.styles';
import {Icon as IconComp} from './Icon';
import styled from 'styled-components';

type AlertProps = {
  severity: string;
};

const BG_COLORS: Record<string, string> = {
  default: hexToRGB(MOON_950, 0.04),
  error: hexToRGB(RED_300, 0.48),
  warning: hexToRGB(GOLD_300, 0.48),
  info: hexToRGB(TEAL_300, 0.48),
  success: hexToRGB(GREEN_300, 0.48),
};

const TEXT_COLORS: Record<string, string> = {
  default: MOON_800,
  error: RED_500,
  warning: GOLD_600,
  info: TEAL_600,
  success: GREEN_600,
};

export const Alert = styled.div<AlertProps>`
  background-color: ${props => BG_COLORS[props.severity]};
  color: ${props => TEXT_COLORS[props.severity]};
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  display: flex;
  align-items: center;
`;

export const Icon = styled(IconComp)`
  font-size: 20px;
  margin-right: 8px;
  flex: 0 0 auto;
`;

export const Message = styled.div`
  // This value chosen to make the alert the same height as our source select widgets.
  padding: 3px;
  flex: 1 1 auto;
`;
