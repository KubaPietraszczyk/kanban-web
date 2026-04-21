import { useEffect, useState, useRef } from "react"
import { withTranslation } from "react-i18next";

function UserSettings({ t, i18n, board}) {
    const [settingsVisible, setSettingsVisible] = useState(false)
    const componentRef = useRef(null);
    const [currentLanguage, setCurrentLanguage] = useState("en")

    useEffect(() => {
        function hideSettings(event: MouseEvent) {
            if (!componentRef?.current?.contains(event.target as Node)) {
                setSettingsVisible(false)
            }
        }

        document.addEventListener("click", hideSettings)

        return () => {
            document.removeEventListener("click", hideSettings)
        }
    }, [])

    const handleSelectLanguage = e => {
        setCurrentLanguage(e.target.value)
        i18n.changeLanguage(e.target.value)
    }

    return (
        <div ref={componentRef}>
            {/* user icon */}
            <button aria-label={settingsVisible ? t("screenReaderOpenUserSettings") : t("screenReaderOpenUserSettings")}
             onClick={() => setSettingsVisible(!settingsVisible)} 
             className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm overflow-hidden border border-slate-600 shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${board?.title ||board?.title || "user"}`} alt="avatar" />
            </button>

            {/* settings menu */}
            {settingsVisible && 
            <section className="absolute top-14 right-0 p-2 bg-[#252830]">
                <h2 className="font-semibold text-[15px] text-slate-200">{t("userSettings")}</h2>
                <label className="text-[15px] text-slate-400">
                    {t("language")}&nbsp;
                    <select id="user-language" onChange={handleSelectLanguage} value={currentLanguage}>
                        <option value="en">English</option>
                        <option value="pl">Polski</option>
                    </select>
                </label>
            </section>}
        </div>
    )
}

export default withTranslation()(UserSettings);