package pe.qorigo.shared.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Aritmética financiera centralizada. Todos los importes se normalizan a 2
 * decimales y nunca se usan tipos de punto flotante.
 */
public final class Dinero {

    public static final int ESCALA = 2;
    public static final RoundingMode REDONDEO = RoundingMode.HALF_UP;

    private Dinero() {
    }

    public static BigDecimal de(String valor) {
        return new BigDecimal(valor).setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal de(Number valor) {
        return BigDecimal.valueOf(valor.doubleValue()).setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal cero() {
        return BigDecimal.ZERO.setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal normalizar(BigDecimal valor) {
        return valor == null ? null : valor.setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal truncar(BigDecimal valor) {
        return valor.setScale(ESCALA, RoundingMode.DOWN);
    }

    public static BigDecimal sumar(BigDecimal... valores) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal valor : valores) {
            if (valor != null) {
                total = total.add(valor);
            }
        }
        return total.setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal restar(BigDecimal a, BigDecimal b) {
        return a.subtract(b).setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal multiplicar(BigDecimal a, BigDecimal b) {
        return a.multiply(b).setScale(ESCALA, REDONDEO);
    }

    public static BigDecimal dividir(BigDecimal a, BigDecimal b, int escala) {
        return a.divide(b, escala, REDONDEO);
    }

    public static BigDecimal max(BigDecimal a, BigDecimal b) {
        return a.max(b).setScale(ESCALA, REDONDEO);
    }

    public static boolean positivo(BigDecimal valor) {
        return valor != null && valor.compareTo(BigDecimal.ZERO) > 0;
    }

    public static boolean cero(BigDecimal valor) {
        return valor == null || valor.compareTo(BigDecimal.ZERO) == 0;
    }

    public static boolean negativo(BigDecimal valor) {
        return valor != null && valor.compareTo(BigDecimal.ZERO) < 0;
    }
}
