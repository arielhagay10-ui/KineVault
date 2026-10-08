import type { SVGProps } from "react";
import {
  faArrowDown, faArrowLeft, faArrowRight, faArrowUp, faArrowUpRightFromSquare,
  faArrowsRotate, faArrowsUpDownLeftRight, faBookOpen, faBox, faCheck,
  faChevronDown, faDumbbell, faExpand, faHand, faHeart, faMagnifyingGlass,
  faMagnifyingGlassMinus, faMagnifyingGlassPlus, faMinimize, faPause, faPlay,
  faPlus, faRotate, faRotateLeft, faRotateRight, faSave, faShieldHalved,
  faSliders, faStar, faTrash, faTriangleExclamation, faUser, faXmark,
  faCircleInfo, faBars, faChair, faWeightHanging, faPerson,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

// Font Awesome Free paths, rendered locally with no kit or runtime DOM changes.
function createIcon(definition: IconDefinition) {
  function Icon({ size = 20, ...props }: IconProps) {
    const [width, height, , , paths] = definition.icon;
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}
      width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false"
      data-icon={definition.iconName} {...props}>
      {(Array.isArray(paths) ? paths : [paths]).map((path, index) => <path key={index} d={path} />)}
    </svg>;
  }
  return Icon;
}

export const ArrowDown = createIcon(faArrowDown);
export const ArrowLeft = createIcon(faArrowLeft);
export const ArrowRight = createIcon(faArrowRight);
export const ArrowUp = createIcon(faArrowUp);
export const ArrowUpRight = createIcon(faArrowUpRightFromSquare);
export const BookOpen = createIcon(faBookOpen);
export const Box = createIcon(faBox);
export const Check = createIcon(faCheck);
export const ChevronDown = createIcon(faChevronDown);
export const Dumbbell = createIcon(faDumbbell);
export const Expand = createIcon(faExpand);
export const Hand = createIcon(faHand);
export const Heart = createIcon(faHeart);
export const Info = createIcon(faCircleInfo);
export const Menu = createIcon(faBars);
export const Minimize = createIcon(faMinimize);
export const Move = createIcon(faArrowsUpDownLeftRight);
export const Move3D = Move;
export const Orbit = createIcon(faArrowsRotate);
export const Pause = createIcon(faPause);
export const Play = createIcon(faPlay);
export const Plus = createIcon(faPlus);
export const Redo2 = createIcon(faRotateRight);
export const Rotate3D = createIcon(faRotate);
export const RotateCcw = createIcon(faRotateLeft);
export const Save = createIcon(faSave);
export const Scan = Expand;
export const Search = createIcon(faMagnifyingGlass);
export const ShieldCheck = createIcon(faShieldHalved);
export const SlidersHorizontal = createIcon(faSliders);
export const Star = createIcon(faStar);
export const Trash2 = createIcon(faTrash);
export const TriangleAlert = createIcon(faTriangleExclamation);
export const Undo2 = createIcon(faRotateLeft);
export const UserRound = createIcon(faUser);
export const X = createIcon(faXmark);
export const ZoomIn = createIcon(faMagnifyingGlassPlus);
export const ZoomOut = createIcon(faMagnifyingGlassMinus);
export const Chair = createIcon(faChair);
export const Weight = createIcon(faWeightHanging);
export const Person = createIcon(faPerson);
