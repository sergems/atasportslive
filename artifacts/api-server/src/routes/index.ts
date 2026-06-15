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

export default router;
