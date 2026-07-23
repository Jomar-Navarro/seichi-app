import {
	Plane, Car, Home, Heart,
	GraduationCap, Shield, Star, TrendingUp,
	type LucideIcon,
} from "lucide-react";

export const GOAL_ICON_MAP: Record<string, LucideIcon> = {
	plane: Plane,
	car: Car,
	home: Home,
	heart: Heart,
	"graduation-cap": GraduationCap,
	shield: Shield,
	star: Star,
	"trending-up": TrendingUp,
};

export const GOAL_ICONS = [
	{ id: "plane", icon: Plane, label: "Viaggio" },
	{ id: "car", icon: Car, label: "Auto" },
	{ id: "home", icon: Home, label: "Casa" },
	{ id: "heart", icon: Heart, label: "Generico" },
	{ id: "graduation-cap", icon: GraduationCap, label: "Formazione" },
	{ id: "shield", icon: Shield, label: "Emergenza" },
	{ id: "star", icon: Star, label: "Altro" },
	{ id: "trending-up", icon: TrendingUp, label: "Investimento" },
] as const;
