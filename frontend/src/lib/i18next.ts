import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en";
import pl from "../locales/pl";

const resources = {
    en: en,
    pl: pl,
}

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "en",
        
        interpolation: {
            escapeValue: false
        }
    })