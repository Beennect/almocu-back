import { createClient } from "redis";

export const redis = createClient({
    url: process.env.REDIS_URI || "redis://localhost:6379"
});

export let redisConnected = false;

export async function connectRedis() 
{
    try 
    {
        await redis.connect();
        redisConnected = true;
        console.log("Redis connected");
    } 
    catch 
    {
        console.log("Redis offline, running without cache");
        redisConnected = false;
    }
}