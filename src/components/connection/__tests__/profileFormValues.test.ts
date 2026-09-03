import { describe, it, expect } from "vitest";
import {
  DEFAULT_FORM_VALUES,
  AMQP_TLS_PORT,
  MANAGEMENT_TLS_PORT,
  withHost,
  withPort,
  withManagementPort,
  cleartextTransports,
  validateProfile,
  profileFromForm,
  formFromProfile,
  type ProfileFormValues,
} from "@/components/connection/profileFormValues";
import type { ConnectionProfile } from "@/lib/types";

describe("withPort", () => {
  it("flips amqpTls on when the port becomes the standard TLS port", () => {
    expect(withPort(DEFAULT_FORM_VALUES, AMQP_TLS_PORT).amqpTls).toBe(true);
  });

  it("flips amqpTls off when the port becomes the standard plaintext port", () => {
    const tlsOn: ProfileFormValues = { ...DEFAULT_FORM_VALUES, amqpTls: true };
    expect(withPort(tlsOn, "5672").amqpTls).toBe(false);
  });

  it("leaves amqpTls unchanged for any other port", () => {
    const tlsOn: ProfileFormValues = { ...DEFAULT_FORM_VALUES, amqpTls: true };
    expect(withPort(tlsOn, "1234").amqpTls).toBe(true);
    expect(withPort(DEFAULT_FORM_VALUES, "1234").amqpTls).toBe(false);
  });

  it("updates the port field itself", () => {
    expect(withPort(DEFAULT_FORM_VALUES, "9999").port).toBe("9999");
  });
});

describe("withManagementPort", () => {
  it("flips managementSsl on when the port becomes the standard TLS port", () => {
    expect(withManagementPort(DEFAULT_FORM_VALUES, MANAGEMENT_TLS_PORT).managementSsl).toBe(true);
  });

  it("flips managementSsl off when the port becomes the standard plaintext port", () => {
    const sslOn: ProfileFormValues = { ...DEFAULT_FORM_VALUES, managementSsl: true };
    expect(withManagementPort(sslOn, "15672").managementSsl).toBe(false);
  });

  it("leaves managementSsl unchanged for any other port", () => {
    const sslOn: ProfileFormValues = { ...DEFAULT_FORM_VALUES, managementSsl: true };
    expect(withManagementPort(sslOn, "1234").managementSsl).toBe(true);
  });
});

describe("withHost", () => {
  it("follows the host to shared when the environment has not been touched", () => {
    expect(withHost(DEFAULT_FORM_VALUES, "mq.internal").environment).toBe("shared");
  });

  it("follows the host to local for a local address", () => {
    const shared: ProfileFormValues = { ...DEFAULT_FORM_VALUES, host: "mq.internal", environment: "shared" };
    expect(withHost(shared, "localhost").environment).toBe("local");
  });

  it("keeps a manually chosen environment once environmentTouched is true", () => {
    const touched: ProfileFormValues = {
      ...DEFAULT_FORM_VALUES,
      environment: "production",
      environmentTouched: true,
    };
    expect(withHost(touched, "mq.internal").environment).toBe("production");
    expect(withHost(touched, "localhost").environment).toBe("production");
  });
});

describe("cleartextTransports", () => {
  it("returns an empty list for localhost", () => {
    expect(cleartextTransports({ ...DEFAULT_FORM_VALUES, host: "localhost" })).toEqual([]);
  });

  it("returns both transports for a remote host with both switches off", () => {
    expect(cleartextTransports({ ...DEFAULT_FORM_VALUES, host: "mq.internal" })).toEqual([
      "AMQP",
      "Management API",
    ]);
  });

  it("returns only the Management API when AMQP TLS is on", () => {
    expect(
      cleartextTransports({ ...DEFAULT_FORM_VALUES, host: "mq.internal", amqpTls: true })
    ).toEqual(["Management API"]);
  });

  it("returns an empty list once both transports are encrypted", () => {
    expect(
      cleartextTransports({
        ...DEFAULT_FORM_VALUES,
        host: "mq.internal",
        amqpTls: true,
        managementSsl: true,
      })
    ).toEqual([]);
  });
});

describe("validateProfile", () => {
  it("requires a profile name", () => {
    expect(validateProfile(DEFAULT_FORM_VALUES, "new")).toBe("Profile name is required.");
  });

  it("requires a host", () => {
    expect(validateProfile({ ...DEFAULT_FORM_VALUES, name: "Local" }, "new")).toBe(
      "Host is required."
    );
  });

  it("requires a password when editing and the password is blank", () => {
    const values: ProfileFormValues = { ...DEFAULT_FORM_VALUES, name: "Local", host: "localhost" };
    expect(validateProfile(values, "edit")).toBe(
      "Password is required to save changes. Enter the current password to keep it, or a new password to change it."
    );
  });

  it("returns null for a valid new profile", () => {
    const values: ProfileFormValues = { ...DEFAULT_FORM_VALUES, name: "Local", host: "localhost" };
    expect(validateProfile(values, "new")).toBeNull();
  });

  it("returns null for a valid edit with a password entered", () => {
    const values: ProfileFormValues = {
      ...DEFAULT_FORM_VALUES,
      name: "Local",
      host: "localhost",
      password: "secret",
    };
    expect(validateProfile(values, "edit")).toBeNull();
  });
});

describe("profileFromForm", () => {
  it("falls back to default ports, vhost, and a null CA path when blank", () => {
    const profile = profileFromForm({
      ...DEFAULT_FORM_VALUES,
      name: "Local",
      host: "localhost",
      port: "",
      managementPort: "",
      vhost: "",
      caCertPath: "",
    });
    expect(profile.port).toBe(5672);
    expect(profile.management_port).toBe(15672);
    expect(profile.vhost).toBe("/");
    expect(profile.ca_cert_path).toBeNull();
  });

  it("trims name, host and username and sends the CA path when present", () => {
    const profile = profileFromForm({
      ...DEFAULT_FORM_VALUES,
      name: "  Local  ",
      host: "  localhost  ",
      username: "  guest  ",
      caCertPath: "  /etc/ssl/ca.pem  ",
    });
    expect(profile.name).toBe("Local");
    expect(profile.host).toBe("localhost");
    expect(profile.username).toBe("guest");
    expect(profile.ca_cert_path).toBe("/etc/ssl/ca.pem");
  });
});

describe("formFromProfile", () => {
  it("maps a saved profile to form values with a blank password", () => {
    const profile: ConnectionProfile = {
      name: "Staging",
      host: "mq.staging.internal",
      port: 5671,
      vhost: "/orders",
      username: "dev",
      management_port: 15671,
      management_ssl: true,
      amqp_tls: true,
      ca_cert_path: "/etc/ssl/ca.pem",
      environment: "shared",
      read_only: true,
      record_history: false,
    };
    const values = formFromProfile(profile);
    expect(values.password).toBe("");
    expect(values.port).toBe("5671");
    expect(values.managementPort).toBe("15671");
    expect(values.environmentTouched).toBe(true);
    expect(values.environment).toBe("shared");
    expect(values.readOnly).toBe(true);
    expect(values.recordHistory).toBe(false);
    expect(values.caCertPath).toBe("/etc/ssl/ca.pem");
  });

  it("defaults ports, ssl flags and history when absent from the profile", () => {
    const profile: ConnectionProfile = {
      name: "Local",
      host: "localhost",
      port: 5672,
      vhost: "/",
      username: "guest",
      management_port: 15672,
      management_ssl: false,
    };
    const values = formFromProfile(profile);
    expect(values.amqpTls).toBe(false);
    expect(values.caCertPath).toBe("");
    expect(values.recordHistory).toBe(true);
    expect(values.environment).toBe("local");
  });
});
