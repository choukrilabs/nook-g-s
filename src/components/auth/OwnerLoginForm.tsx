import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { useTranslation } from "../../i18n";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function OwnerLoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOwner, setCafe } = useAuthStore();
  const { addToast } = useUIStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.user) {
        setOwner(data.user);
        const { data: cafe } = await supabase
          .from("cafes")
          .select("*")
          .eq("owner_id", data.user.id)
          .single();

        if (cafe) {
          setCafe(cafe);
          if (cafe.setup_complete) {
            navigate("/dashboard");
          } else {
            navigate("/wizard");
          }
        } else {
          navigate("/wizard");
        }
      }
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.form
      key="owner-form"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      onSubmit={handleOwnerLogin}
      className="space-y-4"
    >
      <Input
        type="email"
        placeholder={t("auth.email")}
        icon={<Mail size={16} />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type={showPassword ? "text" : "password"}
        placeholder={t("auth.password")}
        icon={<Lock size={16} />}
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-text3 hover:text-text"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" className="w-full" isLoading={isLoading}>
        {t("auth.login")}
      </Button>
      <p className="text-center text-sm text-text3 pt-2">
        {t("auth.no_account")}
        <Link
          to="/register"
          className="text-accent hover:underline font-medium"
        >
          {t("auth.register_link")}
        </Link>
      </p>
    </motion.form>
  );
}
