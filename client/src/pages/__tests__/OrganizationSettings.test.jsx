import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OrganizationSettings from "../OrganizationSettings";
import AppContent from "../../context/AppContent";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/organizationApi", () => ({
  organizationApi: {
    getOrganizationById: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));

import { organizationApi } from "../../services/organizationApi";

describe("OrganizationSettings Page", () => {
  const mockUserData = {
    _id: "user123",
    name: "John Admin",
    email: "john@example.com",
    role: "admin",
    organization: {
      _id: "org123",
      name: "Acme Corp",
    },
  };

  const mockOrgDetails = {
    _id: "org123",
    name: "Acme Corp",
    slug: "acme-corp",
    description: "Building awesome stuff",
    about: "Detailed bio about Acme Corp",
    website: "https://acme.org",
    contactEmail: "contact@acme.org",
    industry: "Software",
    location: "San Francisco, CA",
    logo: "",
    visibility: "public",
    memberCount: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays organization settings", async () => {
    organizationApi.getOrganizationById.mockResolvedValue({
      data: { success: true, organization: mockOrgDetails },
    });

    render(
      <AppContent.Provider
        value={{
          userData: mockUserData,
          getUserData: vi.fn(),
          setUserData: vi.fn(),
        }}
      >
        <MemoryRouter>
          <OrganizationSettings />
        </MemoryRouter>
      </AppContent.Provider>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Building awesome stuff"),
      ).toBeInTheDocument();
    });
  });

  it("shows read-only message when user is a non-admin member", async () => {
    organizationApi.getOrganizationById.mockResolvedValue({
      data: { success: true, organization: mockOrgDetails },
    });

    const memberUserData = { ...mockUserData, role: "member" };

    render(
      <AppContent.Provider
        value={{
          userData: memberUserData,
          getUserData: vi.fn(),
          setUserData: vi.fn(),
        }}
      >
        <MemoryRouter>
          <OrganizationSettings />
        </MemoryRouter>
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Read-Only Mode")).toBeInTheDocument();
    });
  });
});
