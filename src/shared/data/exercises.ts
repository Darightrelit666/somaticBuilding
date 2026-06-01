import openExercisesRaw from "./open-exercises.json";

const baseExercises = [
  {
    id: "1",
    name: "Barbell Back Squat",
    imageUrl: "https://images.unsplash.com/photo-1770026136877-8ddf98cd6500?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcXVhdCUyMGV4ZXJjaXNlJTIwZml0bmVzc3xlbnwxfHx8fDE3NzMwNjE0MTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Squat",
    abilityTag: "Intermediate",
    equipmentTag: "Barbell",
    difficulty: "Hard"
  },
  {
    id: "2",
    name: "Conventional Deadlift",
    imageUrl: "https://images.unsplash.com/photo-1772450014622-1c209d012c2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWFkbGlmdCUyMGZpdG5lc3MlMjB3ZWlnaHRsaWZ0aW5nfGVufDF8fHx8MTc3MzA2NDI2NXww&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Hinge",
    abilityTag: "Advanced",
    equipmentTag: "Barbell",
    difficulty: "Hard"
  },
  {
    id: "3",
    name: "Flat Bench Press",
    imageUrl: "https://images.unsplash.com/photo-1652363722856-214ce6a06a44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZW5jaCUyMHByZXNzJTIwZml0bmVzcyUyMGd5bXxlbnwxfHx8fDE3NzMwNjQyNjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Horiz. Push",
    abilityTag: "Intermediate",
    equipmentTag: "Barbell",
    difficulty: "Medium"
  },
  {
    id: "4",
    name: "Strict Pull-Up",
    imageUrl: "https://images.unsplash.com/photo-1677165733273-dcc3724c00e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdWxsJTIwdXAlMjB3b3Jrb3V0JTIwZ3ltfGVufDF8fHx8MTc3MzA2NDI2NXww&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Vertical Pull",
    abilityTag: "Intermediate",
    equipmentTag: "Bodyweight",
    difficulty: "Medium"
  },
  {
    id: "5",
    name: "Standard Push-Up",
    imageUrl: "https://images.unsplash.com/photo-1686247166156-0bca3e8b55d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdXNoJTIwdXAlMjBleGVyY2lzZSUyMGZpdG5lc3N8ZW58MXx8fHwxNzczMDY0MjY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Horiz. Push",
    abilityTag: "Beginner",
    equipmentTag: "Bodyweight",
    difficulty: "Easy"
  },
  {
    id: "6",
    name: "Walking Lunge",
    imageUrl: "https://images.unsplash.com/photo-1758599880618-3f03f2a401b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdW5nZSUyMGV4ZXJjaXNlJTIwd29ya291dHxlbnwxfHx8fDE3NzMwNjE4ODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    movementPattern: "Lunge",
    abilityTag: "Beginner",
    equipmentTag: "Bodyweight",
    difficulty: "Medium"
  },
  {
    id: "7",
    name: "Dumbbell Shoulder Press",
    imageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=1080",
    movementPattern: "Vert. Push",
    abilityTag: "Intermediate",
    equipmentTag: "Dumbbell",
    difficulty: "Medium"
  },
  {
    id: "8",
    name: "Kettlebell Swing",
    imageUrl: "https://images.unsplash.com/photo-1519500528733-69f8897c8808?auto=format&fit=crop&q=80&w=1080",
    movementPattern: "Hinge",
    abilityTag: "Beginner",
    equipmentTag: "Kettlebell",
    difficulty: "Medium"
  }
];

const openExercises = Array.isArray(openExercisesRaw) ? openExercisesRaw : [];

export const exercises = openExercises.length > 0 ? openExercises : baseExercises;
