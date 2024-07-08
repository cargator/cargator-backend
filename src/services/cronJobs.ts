import { checkOrders } from "../helpers/orderEvents";
import { refreshToken } from "../main/auth";
import { getUtilsData } from "./utilsService";

const cron = require('node-cron');
const CronJob = require('cron').CronJob;

let utilsData: any;

export async function setUpCronJobs() {
    try {
        utilsData = await getUtilsData();
        await refreshToken();
        // Define your cron job schedule (runs every 15 minutes)
        const cronExpression = '0 */15 * * * *';

        // Create a new cron job
        const job = new CronJob(cronExpression, async () => {
            try {
                console.log('Cron job executed at:', new Date());
                utilsData = await getUtilsData();
            } catch (error) {
                console.error('Error executing cron job:', error);
            }
        });

        // Start the cron job
        job.start();
        // Schedule the cron job to run every 23 hours (or any desired interval)
        cron.schedule('0 0 */23 * * *', async () => {
            try {
                await refreshToken();
            } catch (error) {
                console.error('Error refreshing token:', error);
            }
        });

        // Schedule the cron job to check pre-book rides and orders every 10 seconds
        cron.schedule('*/10 * * * * *', async () => {
            try {
                console.log('Check Orders every 10 seconds!');
                await checkOrders(undefined);
            } catch (error) {
                console.error('Error check orders:', error);
            }
        });
    } catch (err) {
        console.log('err', err);
    }
}
