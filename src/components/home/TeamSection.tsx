"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  Github,
  Linkedin,
  Mail,
  MapPin,
  Sparkles,
  Twitter,
} from "lucide-react";
import { useState } from "react";

const members = [
  {
    name: "Sarah Johnson",
    role: "CEO & Founder",
    bio: "Visionary leader with 15+ years in tech",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    location: "San Francisco",
    skills: ["Strategy", "Leadership", "Innovation"],
    gradient: "from-white/10 via-white/5 to-transparent",
  },
  {
    name: "Michael Chen",
    role: "CTO",
    bio: "Full-stack architect and AI enthusiast",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    location: "New York",
    skills: ["AI/ML", "Architecture", "Cloud"],
    gradient: "from-white/12 via-white/5 to-transparent",
  },
  {
    name: "Emily Rodriguez",
    role: "Head of Design",
    bio: "Creative mind behind beautiful interfaces",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    location: "London",
    skills: ["UI/UX", "Branding", "Motion"],
    gradient: "from-white/12 via-white/5 to-transparent",
  },
  {
    name: "David Park",
    role: "Lead Developer",
    bio: "Code wizard and performance optimizer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    location: "Tokyo",
    skills: ["React", "TypeScript", "Performance"],
    gradient: "from-foreground/12 via-foreground/5 to-transparent",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] },
  },
};

const socials = [{ icon: Twitter }, { icon: Linkedin }, { icon: Github }, { icon: Mail }];

function MemberCard({ m }: { m: (typeof members)[0] }) {
  const [hovered, setHovered] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rm = useReducedMotion();

  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), {
    stiffness: 300,
    damping: 30,
  });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) / (r.width / 2));
    my.set((e.clientY - r.top - r.height / 2) / (r.height / 2));
  };

  return (
    <motion.div variants={itemVariants} className="perspective-1000">
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={onMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
          setHovered(false);
        }}
        className="group relative"
      >
        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-card backdrop-blur-xl transition-shadow duration-500">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${m.gradient}`}
            animate={{ opacity: hovered ? 1 : rm ? 0.05 : 0 }}
          />
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.6 }}
            className="absolute right-4 top-4 z-10"
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </motion.div>

          <div className="relative z-10 p-6">
            <div className="mb-4 flex justify-center">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <motion.div
                  className="absolute -inset-2 rounded-full blur-2xl opacity-0 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(135deg,rgba(255,255,255,0.25),rgba(255,255,255,0))",
                  }}
                  animate={
                    hovered
                      ? { rotate: rm ? 0 : 360, scale: rm ? 1 : [1, 1.08, 1] }
                      : { rotate: 0, scale: 1 }
                  }
                  transition={{
                    duration: rm ? 0.6 : 3,
                    repeat: rm ? 0 : Infinity,
                    ease: "linear",
                  }}
                />
                <div className="relative h-28 w-28 overflow-hidden rounded-full border border-border/60 bg-card/80 p-1">
                  <motion.img
                    src={m.image}
                    alt={m.name}
                    className="h-full w-full rounded-full object-cover"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            </div>

            <div className="text-center">
              <motion.h3
                className="mb-1 text-xl font-semibold tracking-tight text-foreground"
                animate={{ scale: hovered ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {m.name}
              </motion.h3>
              <Badge
                variant="secondary"
                className="mb-2 bg-white/10 text-xs uppercase tracking-[0.28em] text-muted-foreground backdrop-blur"
              >
                {m.role}
              </Badge>
              <div className="mb-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{m.location}</span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{m.bio}</p>

              <motion.div
                className="mb-4 flex flex-wrap justify-center gap-1.5"
                animate={{ opacity: hovered ? 1 : 0.7 }}
              >
                {m.skills.map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 * i, type: "spring" }}
                  >
                    <Badge
                      variant="outline"
                      className="border-border/60 bg-white/5 text-xs text-muted-foreground hover:bg-white/10"
                    >
                      {s}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>

              <div className="flex justify-center gap-2">
                {socials.map(({ icon: Icon }, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: hovered ? 1 : 0.85,
                    }}
                    transition={{
                      delay: hovered ? 0.1 * i : 0,
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full border border-border/40 bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export function TeamSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="outline" className="mb-4">
            Meet Our Team
          </Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            我们的团队
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            由行业专家组成的多元化团队，致力于打造最优质的虚拟试衣体验
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {members.map((m) => (
            <MemberCard key={m.name} m={m} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
