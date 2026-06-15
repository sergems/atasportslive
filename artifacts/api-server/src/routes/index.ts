import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import walletRouter from "./wallet";
import streamsRouter from "./streams";
import gamesRouter from "./games";
import betsRouter from "./bets";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import reportsRouter from "./reports";
import uploadsRouter from "./uploads";
import announcementsRouter from "./announcements";
import highlightsRouter from "./highlights";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/wallet", walletRouter);
router.use("/streams", streamsRouter);
router.use("/games", gamesRouter);
router.use("/bets", betsRouter);
router.use("/notifications", notificationsRouter);
router.use("/admin", adminRouter);
router.use("/reports", reportsRouter);
router.use("/uploads", uploadsRouter);
router.use("/announcements", announcementsRouter);
router.use("/highlights", highlightsRouter);
router.use("/settings", settingsRouter);

export default router;
