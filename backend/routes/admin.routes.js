const express = require("express");
const router = express.Router();
const admin = require("../controllers/admin.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.use(requireAuth, requireRole("ADMIN"));

// logins
router.post("/create-teacher-login", admin.createTeacherLogin);
router.post("/create-student-login", admin.createStudentLogin);

// teachers
router.get("/teachers", admin.listTeachers);
router.post("/teachers", admin.createTeacher);
router.put("/teachers/:id", admin.updateTeacher);
router.delete("/teachers/:id", admin.deleteTeacher);

// students
router.get("/students", admin.listStudents);
router.post("/students", admin.createStudent);
router.put("/students/:id", admin.updateStudent);
router.delete("/students/:id", admin.deleteStudent);

// classes
router.get("/classes", admin.listClasses);
router.post("/classes", admin.createClass);
router.delete("/classes/:id", admin.deleteClass);

// subjects
router.get("/subjects", admin.listSubjects);
router.post("/subjects", admin.createSubject);
router.delete("/subjects/:id", admin.deleteSubject);

// teacher-subject mapping
router.post("/teacher-subjects", admin.assignTeacherSubject);
router.delete("/teacher-subjects/:id", admin.unassignTeacherSubject);

// routine
router.get("/routine", admin.listRoutine);
router.post("/routine", admin.createRoutine);
router.delete("/routine/:id", admin.deleteRoutine);

module.exports = router;
