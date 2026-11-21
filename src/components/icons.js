// Pixel icon set for the Bead Board world. Keeps the lucide names the app
// already imports, so call sites stay unchanged.
import { createElement } from 'react';
import {
  WarningDiamond, ArrowRight as PxArrowRight, BookOpen as PxBookOpen, BadgeCaptions, Check as PxCheck,
  ChevronLeft as PxChevronLeft, ChevronRight as PxChevronRight, Cancel, Clapperboard as PxClapperboard,
  Clock as PxClock, Video, SpeedMedium, Heart as PxHeart, Image, CircleInfo, Expand, Collapse,
  Menu as PxMenu, Mic as PxMic, Pause as PxPause, PictureInPicture as PxPip, Play as PxPlay,
  Search as PxSearch, Server as PxServer, Undo, Redo, Sparkles as PxSparkles, Star as PxStar, Label,
  ArrowLeft as PxArrowLeft, Calendar as PxCalendar, Download as PxDownload, ExternalLink as PxExternalLink, Fire, Shield, Bulletlist,
  UserPlus as PxUserPlus, Volume1 as PxVolume1, Volume3, VolumeX as PxVolumeX, Close,
} from 'pixelarticons/react';

// lucide's `size`/`strokeWidth` have no meaning for filled pixel paths.
const px = (Icon) => {
  const C = ({ size, ...props }) => {
    delete props.strokeWidth;
    return createElement(Icon, size ? { width: size, height: size, ...props } : props);
  };
  return C;
};

export const AlertCircle = px(WarningDiamond);
export const AlertTriangle = px(WarningDiamond);
export const ArrowRight = px(PxArrowRight);
export const BookOpen = px(PxBookOpen);
export const Captions = px(BadgeCaptions);
export const Subtitles = px(BadgeCaptions);
export const Check = px(PxCheck);
export const ChevronLeft = px(PxChevronLeft);
export const ChevronRight = px(PxChevronRight);
export const CircleOff = px(Cancel);
export const Clapperboard = px(PxClapperboard);
export const Clock = px(PxClock);
export const Film = px(Video);
export const Gauge = px(SpeedMedium);
export const Heart = px(PxHeart);
export const ImageIcon = px(Image);
export const Info = px(CircleInfo);
export const Maximize2 = px(Expand);
export const Minimize2 = px(Collapse);
export const Menu = px(PxMenu);
export const Mic = px(PxMic);
export const Pause = px(PxPause);
export const PictureInPicture = px(PxPip);
export const PictureInPicture2 = px(PxPip);
export const Play = px(PxPlay);
export const Search = px(PxSearch);
export const Server = px(PxServer);
export const SkipBack = px(Undo);
export const SkipForward = px(Redo);
export const Sparkles = px(PxSparkles);
export const Star = px(PxStar);
export const Tag = px(Label);
export const UserPlus = px(PxUserPlus);
export const Volume1 = px(PxVolume1);
export const Volume2 = px(Volume3);
export const VolumeX = px(PxVolumeX);
export const X = px(Close);
export const ArrowLeft = px(PxArrowLeft);
export const Calendar = px(PxCalendar);
export const Download = px(PxDownload);
export const ExternalLink = px(PxExternalLink);
export const Flame = px(Fire);
export const ShieldAlert = px(Shield);
export const ListOrdered = px(Bulletlist);
