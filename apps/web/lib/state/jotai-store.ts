"use client";

import { createStore } from "jotai";

// Single global Jotai store so atoms are readable outside React components
export const jotaiStore = createStore();
