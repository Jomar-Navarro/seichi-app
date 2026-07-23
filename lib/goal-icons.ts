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

export const GOAL_ICONS: { id: string; icon: SeichiIcon; label: string }[] = [
	{ id: "plane", icon: PlaneIcon, label: "Viaggio" },
	{ id: "car", icon: CarIcon, label: "Auto" },
	{ id: "home", icon: HomeIcon, label: "Casa" },
	{ id: "heart", icon: HeartIcon, label: "Generico" },
	{ id: "graduation-cap", icon: GraduationCapIcon, label: "Formazione" },
	{ id: "shield", icon: ShieldIcon, label: "Emergenza" },
	{ id: "star", icon: StarIcon, label: "Altro" },
	{ id: "trending-up", icon: TrendingUpIcon, label: "Investimento" },
];
