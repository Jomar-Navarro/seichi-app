import type { SeichiIcon } from "./seichi-icons";
import {
	PlaneIcon,
	CarIcon,
	HomeIcon,
	HeartIcon,
	GraduationCapIcon,
	ShieldIcon,
	StarIcon,
	TrendingUpIcon,
} from "./seichi-icons";

export const GOAL_ICON_MAP: Record<string, SeichiIcon> = {
	plane: PlaneIcon,
	car: CarIcon,
	home: HomeIcon,
	heart: HeartIcon,
	"graduation-cap": GraduationCapIcon,
	shield: ShieldIcon,
	star: StarIcon,
	"trending-up": TrendingUpIcon,
};

/*
 * issue #126 — qui c'era anche `label` in italiano, scritta a mano e mai
 * letta da nessuno: gli 8 bottoni-icona di `GoalSheet` non avevano un nome
 * accessibile. Le parole ora vivono in `t.goals.goalIcons` (entrambe le
 * lingue), come ogni altra stringa rivolta all'utente; qui resta solo la
 * meccanica — id e componente icona.
 */
export const GOAL_ICONS: { id: string; icon: SeichiIcon }[] = [
	{ id: "plane", icon: PlaneIcon },
	{ id: "car", icon: CarIcon },
	{ id: "home", icon: HomeIcon },
	{ id: "heart", icon: HeartIcon },
	{ id: "graduation-cap", icon: GraduationCapIcon },
	{ id: "shield", icon: ShieldIcon },
	{ id: "star", icon: StarIcon },
	{ id: "trending-up", icon: TrendingUpIcon },
];
