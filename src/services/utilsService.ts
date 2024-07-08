import { Utils } from "../models";

interface UtilsData {
    georange: string;
    nearbyDriversDistanceInKm: number;
    baseFare: number;
    debounceTime: number;
    preBookRideTime?: number;
    scheduleRideInterval?: number;
}

const defaultUtilsData: UtilsData = {
    georange: '0.015',
    nearbyDriversDistanceInKm: 5,
    baseFare: 15,
    debounceTime: 500,
    preBookRideTime: 20,
    scheduleRideInterval: 5,
};

export async function getUtilsData(): Promise<UtilsData> {
    try {
        const utilsData = await Utils.findOne({ _id: '64c8b0909850db70747e62b9' }).lean().exec();
        if (!utilsData) {
            console.warn('No utils data found. Using default values.');
            return defaultUtilsData;
        }
        // Cast utilsData to UtilsData to satisfy TypeScript
        return utilsData as UtilsData;
    } catch (error) {
        console.error('Error fetching utils data:', error);
        throw new Error('Error fetching utils data');
    }
}