/**
 * SillyTavern API Client
 * Wraps HTTP communication with the backend.
 */

import type { AxiosInstance } from "axios";
import axios from "axios";
import https from "node:https";
import { ConfigLoader } from "../services/config";

export class TavernAPI {
    private static client: AxiosInstance | null = null;

    private static getClient(): AxiosInstance {
        if (this.client) return this.client;

        const config = ConfigLoader.load();
        const baseURL = config.apiUrl;

        // Create Axios Instance
        this.client = axios.create({
            baseURL,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            // Security: Only ignore self-signed certs if explicitly configured
            httpsAgent: new https.Agent({
                rejectUnauthorized: !(config.insecure === true),
            }),
            validateStatus: () => true,
        });

        // Basic Auth
        if (config.username && config.password) {
            const credentials = Buffer.from(`${config.username}:${config.password}`).toString("base64");
            this.client.defaults.headers.common["Authorization"] = `Basic ${credentials}`;
        }

        return this.client;
    }

    /**
     * Unified fetch wrapper
     */
    static async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const client = this.getClient();
        const method = options.method || "GET";

        let data = undefined;
        if (options.body) {
            if (typeof options.body === 'string') {
                try {
                    data = JSON.parse(options.body);
                } catch {
                    data = options.body;
                }
            } else {
                data = options.body;
            }
        }

        try {
            const response = await client.request({
                url: endpoint,
                method,
                data,
                headers: options.headers as any,
            });

            if (response.status < 200 || response.status >= 300) {
                const errorText = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data);

                throw new Error(
                    `Tavern API Error: ${response.status} ${response.statusText} - ${errorText}`
                );
            }

            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Fetch binary data (e.g. images)
     */
    static async fetchBinary(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ArrayBuffer> {
        const client = this.getClient();
        const method = options.method || "GET";

        let data = undefined;
        if (options.body) {
            if (typeof options.body === 'string') {
                try {
                    data = JSON.parse(options.body);
                } catch {
                    data = options.body;
                }
            } else {
                data = options.body;
            }
        }

        try {
            const response = await client.request({
                url: endpoint,
                method,
                data,
                headers: options.headers as any,
                responseType: 'arraybuffer'
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`Tavern API Error: ${response.status} ${response.statusText}`);
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Check connection to SillyTavern
     */
    static async checkConnection(): Promise<boolean> {
        try {
            const client = this.getClient();
            const res = await client.post("/api/settings/get");
            return res.status === 200;
        } catch {
            return false;
        }
    }
}
