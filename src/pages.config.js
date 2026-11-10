import { lazy } from 'react';
import __Layout from './Layout.jsx';

const Credits = lazy(() => import('./pages/Credits'));
const Home = lazy(() => import('./pages/Home'));
const NewDispute = lazy(() => import('./pages/NewDispute'));
const Results = lazy(() => import('./pages/Results'));
const Settings = lazy(() => import('./pages/Settings'));
const History = lazy(() => import('./pages/History'));

export const PAGES = {
    "Credits": Credits,
    "Home": Home,
    "NewDispute": NewDispute,
    "Results": Results,
    "Settings": Settings,
    "History": History,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
