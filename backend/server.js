import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MOODLE_BASE_URL = process.env.MOODLE_BASE_URL || "";
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || "";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 600);
const LOGO_FOLDER = process.env.LOGO_FOLDER || "public/logos";
const USE_MOCK = String(process.env.USE_MOCK || "").toLowerCase() === "true";

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });

app.use("/logos", express.static(path.join(__dirname, LOGO_FOLDER)));

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function moodleUrl(fn, params = {}) {
  const search = new URLSearchParams({
    wstoken: MOODLE_TOKEN,
    wsfunction: fn,
    moodlewsrestformat: "json",
    ...params,
  });
  return `${MOODLE_BASE_URL}/webservice/rest/server.php?${search.toString()}`;
}

async function moodleGet(fn, params = {}) {
  if (!MOODLE_BASE_URL || !MOODLE_TOKEN) {
    throw new Error("Moodle base URL or token not configured");
  }
  const url = moodleUrl(fn, params);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Moodle API error: ${res.status}`);
  }
  return res.json();
}

function buildMockLeaderboard() {
  return [
    { name: "School 1", shortname: "school_1", tasksCompleted: 245, logo: "/logos/school-1.png" },
    { name: "School 2", shortname: "school_2", tasksCompleted: 198, logo: "/logos/school-2.png" },
    { name: "School 3", shortname: "school_3", tasksCompleted: 176, logo: "/logos/school-3.png" },
    { name: "School 4", shortname: "school_4", tasksCompleted: 104, logo: "/logos/school-4.png" },
    { name: "School 5", shortname: "school_5", tasksCompleted: 99, logo: "/logos/school-5.png" },
    { name: "School 6", shortname: "school_6", tasksCompleted: 93, logo: "/logos/school-6.png" },
    { name: "School 7", shortname: "school_7", tasksCompleted: 88, logo: "/logos/school-7.png" },
    { name: "School 8", shortname: "school_8", tasksCompleted: 84, logo: "/logos/school-8.png" },
    { name: "School 9", shortname: "school_9", tasksCompleted: 79, logo: "/logos/school-9.png" },
    { name: "School 10", shortname: "school_10", tasksCompleted: 73, logo: "/logos/school-10.png" },
    { name: "School 11", shortname: "school_11", tasksCompleted: 68, logo: "/logos/school-11.png" }
  ];
}

async function getCategories() {
  // Fetch all categories (schools)
  // core_course_get_categories
  return moodleGet("core_course_get_categories");
}

async function getCoursesByCategory(categoryId) {
  // Fetch courses for a category
  // core_course_get_courses_by_field
  const data = await moodleGet("core_course_get_courses_by_field", {
    field: "category",
    value: String(categoryId),
  });
  return data?.courses || [];
}

async function getQuizzesByCourse(courseId) {
  // Fetch quizzes in a course
  // mod_quiz_get_quizzes_by_courses
  const data = await moodleGet("mod_quiz_get_quizzes_by_courses", {
    "courseids[0]": String(courseId),
  });
  return data?.quizzes || [];
}

async function countPassedAttempts(quizId, passingGrade) {
  // Placeholder. Moodle does not provide a simple "all users" quiz attempts endpoint.
  // We will implement this once Web Services is enabled and we pick a report-based method.
  void quizId;
  void passingGrade;
  return 0;
}

async function buildLeaderboard() {
  const categories = await getCategories();
  const schools = [];

  for (const category of categories) {
    const courses = await getCoursesByCategory(category.id);
    let totalPassed = 0;

    for (const course of courses) {
      const quizzes = await getQuizzesByCourse(course.id);
      for (const quiz of quizzes) {
        const passingGrade = quiz.grade || 0;
        totalPassed += await countPassedAttempts(quiz.id, passingGrade);
      }
    }

    const key = category.idnumber || category.name || `category-${category.id}`;
    const shortname = slugify(key) || `category-${category.id}`;

    schools.push({
      id: category.id,
      name: category.name,
      shortname,
      logo: `/logos/${shortname}.png`,
      tasksCompleted: totalPassed,
    });
  }

  schools.sort((a, b) => b.tasksCompleted - a.tasksCompleted);

  return schools;
}

app.get("/api/leaderboard", async (req, res) => {
  try {
    if (USE_MOCK || !MOODLE_BASE_URL || !MOODLE_TOKEN) {
      return res.json({ source: "mock", data: buildMockLeaderboard() });
    }

    const cached = cache.get("leaderboard");
    if (cached) {
      return res.json({ source: "cache", data: cached });
    }

    const data = await buildLeaderboard();
    cache.set("leaderboard", data);

    return res.json({ source: "live", data });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Unknown error",
      hint: "Make sure MOODLE_BASE_URL and MOODLE_TOKEN are set, and Web Services is enabled.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Leaderboard backend running on port ${PORT}`);
});
